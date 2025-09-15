/**
 * AST to MongoDB Query Translator
 * Converts rule AST (Abstract Syntax Tree) to MongoDB query objects
 * Handles primitive arrays, strings, dates, and logical operators robustly
 */

class ASTToMongoQuery {
  constructor() {
    this.operators = {
      '=': '$eq',
      '!=': '$ne',
      '>': '$gt',
      '<': '$lt',
      '>=': '$gte',
      '<=': '$lte',
      'IN': '$in',
      'NOT_IN': '$nin',
      'CONTAINS': '$regex',
      'NOT_CONTAINS': '$not'
    };

    // Define which fields are dates and which are arrays
    this.dateFields = ['created_at', 'updated_at', 'last_order_at', 'last_visit_at'];
    this.arrayFields = ['emails', 'phones', 'tags', 'categories'];
  }

  /**
   * Convert AST to MongoDB query
   * @param {Object} ast - Rule AST object
   * @returns {Object} MongoDB query object
   */
  translate(ast) {
    if (!ast || (Object.keys(ast).length === 0)) {
      return {}; // match all documents
    }
    return this.processNode(ast);
  }

  /**
   * Process a single AST node
   * @param {Object} node - AST node
   * @returns {Object} MongoDB query fragment
   */
  processNode(node) {
    if (!node) return {};

    if (node.type === 'condition') {
      return this.processCondition(node);
    }

    if (node.op) {
      return this.processLogicalOperator(node);
    }

    return {};
  }

  /**
   * Process a condition node
   * @param {Object} condition - Condition node
   * @returns {Object} MongoDB query fragment
   */
  processCondition(condition) {
    const { field, operator, value } = condition;

    if (!field || !operator) {
      throw new Error('Invalid condition: missing field or operator');
    }

    const mongoOperator = this.operators[operator];
    if (!mongoOperator) {
      throw new Error(`Unsupported operator: ${operator}`);
    }

    // Handle CONTAINS and NOT_CONTAINS (string/array regex)
    if (operator === 'CONTAINS') {
      return { [field]: { $regex: value, $options: 'i' } };
    }
    if (operator === 'NOT_CONTAINS') {
      return { [field]: { $not: { $regex: value, $options: 'i' } } };
    }

    // Handle date fields
    if (this.isDateField(field) && typeof value === 'string') {
      const dateValue = this.parseDateValue(value);
      return { [field]: { [mongoOperator]: dateValue } };
    }

    // Handle array fields (primitive arrays like phones/emails/tags)
    if (this.isArrayField(field)) {
      return this.processArrayCondition(field, operator, value);
    }

    // Default scalar field
    return { [field]: { [mongoOperator]: value } };
  }

  /**
   * Process logical operators (AND, OR, NOT)
   * @param {Object} node - Logical operator node
   * @returns {Object} MongoDB query fragment
   */
  processLogicalOperator(node) {
    const { op, children } = node;

    if (!children || !Array.isArray(children)) {
      throw new Error(`Invalid logical operator: ${op} requires children`);
    }

    if ((op === 'AND' || op === 'OR') && children.length === 0) {
      return {}; // empty AND/OR = match all
    }

    switch (op) {
      case 'AND':
        return { $and: children.map(child => this.processNode(child)) };
      case 'OR':
        return { $or: children.map(child => this.processNode(child)) };
      case 'NOT':
        if (children.length !== 1) {
          throw new Error('NOT operator requires exactly one child');
        }
        return { $nor: [this.processNode(children[0])] }; // ✅ use $nor instead of $not for full condition negation
      default:
        throw new Error(`Unsupported logical operator: ${op}`);
    }
  }

  /**
   * Process array field conditions
   * @param {string} field - Field name
   * @param {string} operator - Operator
   * @param {any} value - Value
   * @returns {Object} MongoDB query fragment
   */
  processArrayCondition(field, operator, value) {
    const values = Array.isArray(value) ? value : [value];

    switch (operator) {
      case '=':
      case 'IN':
        return { [field]: { $in: values } };
      case '!=':
      case 'NOT_IN':
        return { [field]: { $nin: values } };
      case 'CONTAINS':
        return { [field]: { $regex: value, $options: 'i' } };
      case 'NOT_CONTAINS':
        return { [field]: { $not: { $regex: value, $options: 'i' } } };
      default:
        throw new Error(`Unsupported operator for array field ${field}: ${operator}`);
    }
  }

  /**
   * Check if field is a date field
   * @param {string} field - Field name
   * @returns {boolean}
   */
  isDateField(field) {
    return this.dateFields.includes(field);
  }

  /**
   * Check if field is an array field
   * @param {string} field - Field name
   * @returns {boolean}
   */
  isArrayField(field) {
    return this.arrayFields.includes(field);
  }

  /**
   * Parse date value from string
   * Supports formats: "7 days ago", "2 weeks ago", "3 months ago", "YYYY-MM-DD"
   * @param {string} value - Date string
   * @returns {Date}
   */
  parseDateValue(value) {
    if (typeof value === 'string') {
      const now = new Date();

      const monthsMatch = value.match(/(\d+)\s*months?\s*ago/i);
      if (monthsMatch) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - parseInt(monthsMatch[1]));
        return date;
      }

      const weeksMatch = value.match(/(\d+)\s*weeks?\s*ago/i);
      if (weeksMatch) {
        const date = new Date(now);
        date.setDate(date.getDate() - (parseInt(weeksMatch[1]) * 7));
        return date;
      }

      const daysMatch = value.match(/(\d+)\s*days?\s*ago/i);
      if (daysMatch) {
        const date = new Date(now);
        date.setDate(date.getDate() - parseInt(daysMatch[1]));
        return date;
      }

      if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        return new Date(value);
      }
    }

    if (value instanceof Date) return value;

    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }

    return parsed;
  }

  /**
   * Validate AST structure
   * @param {Object} ast - AST to validate
   * @returns {boolean}
   */
  validateAST(ast) {
    if (!ast) return false;

    if (ast.type === 'condition') {
      return !!(ast.field && ast.operator);
    }

    if (ast.op) {
      if (!['AND', 'OR', 'NOT'].includes(ast.op)) return false;
      if (!ast.children || !Array.isArray(ast.children)) return false;

      if (ast.op === 'NOT' && ast.children.length !== 1) return false;
      if ((ast.op === 'AND' || ast.op === 'OR') && ast.children.length === 0) return true;

      return ast.children.every(child => this.validateAST(child));
    }

    return false;
  }
}

module.exports = new ASTToMongoQuery();
