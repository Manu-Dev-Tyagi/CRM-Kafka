const astToMongoQuery = require('../../src/utils/astToMongoQuery');

describe('AST to MongoDB Query Translator', () => {
  describe('validateAST', () => {
    test('should validate simple condition AST', () => {
      const ast = {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 1000
      };
      expect(astToMongoQuery.validateAST(ast)).toBe(true);
    });

    test('should validate AND operator AST', () => {
      const ast = {
        op: 'AND',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '>',
            value: 1000
          },
          {
            type: 'condition',
            field: 'visits',
            operator: '<',
            value: 5
          }
        ]
      };
      expect(astToMongoQuery.validateAST(ast)).toBe(true);
    });

    test('should validate OR operator AST', () => {
      const ast = {
        op: 'OR',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '>',
            value: 5000
          },
          {
            type: 'condition',
            field: 'visits',
            operator: '>',
            value: 10
          }
        ]
      };
      expect(astToMongoQuery.validateAST(ast)).toBe(true);
    });

    test('should validate NOT operator AST', () => {
      const ast = {
        op: 'NOT',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '=',
            value: 0
          }
        ]
      };
      expect(astToMongoQuery.validateAST(ast)).toBe(true);
    });

    test('should reject invalid condition AST', () => {
      const ast = {
        type: 'condition',
        field: 'total_spend'
        // missing operator and value
      };
      expect(astToMongoQuery.validateAST(ast)).toBe(false);
    });

    test('should reject invalid operator AST', () => {
      const ast = {
        op: 'INVALID',
        children: []
      };
      expect(astToMongoQuery.validateAST(ast)).toBe(false);
    });

    test('should reject NOT operator with multiple children', () => {
      const ast = {
        op: 'NOT',
        children: [
          { type: 'condition', field: 'a', operator: '=', value: 1 },
          { type: 'condition', field: 'b', operator: '=', value: 2 }
        ]
      };
      expect(astToMongoQuery.validateAST(ast)).toBe(false);
    });
  });

  describe('translate', () => {
    test('should translate simple condition', () => {
      const ast = {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 1000
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        total_spend: { $gt: 1000 }
      });
    });

    test('should translate equality condition', () => {
      const ast = {
        type: 'condition',
        field: 'name',
        operator: '=',
        value: 'John Doe'
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        name: { $eq: 'John Doe' }
      });
    });

    test('should translate IN condition', () => {
      const ast = {
        type: 'condition',
        field: 'status',
        operator: 'IN',
        value: ['active', 'pending']
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        status: { $in: ['active', 'pending'] }
      });
    });

    test('should translate CONTAINS condition', () => {
      const ast = {
        type: 'condition',
        field: 'name',
        operator: 'CONTAINS',
        value: 'John'
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        name: { $regex: 'John', $options: 'i' }
      });
    });

    test('should translate AND operator', () => {
      const ast = {
        op: 'AND',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '>',
            value: 1000
          },
          {
            type: 'condition',
            field: 'visits',
            operator: '<',
            value: 5
          }
        ]
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        $and: [
          { total_spend: { $gt: 1000 } },
          { visits: { $lt: 5 } }
        ]
      });
    });

    test('should translate OR operator', () => {
      const ast = {
        op: 'OR',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '>',
            value: 5000
          },
          {
            type: 'condition',
            field: 'visits',
            operator: '>',
            value: 10
          }
        ]
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        $or: [
          { total_spend: { $gt: 5000 } },
          { visits: { $gt: 10 } }
        ]
      });
    });

    test('should translate NOT operator', () => {
      const ast = {
        op: 'NOT',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '=',
            value: 0
          }
        ]
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        $not: { total_spend: { $eq: 0 } }
      });
    });

    test('should translate complex nested AST', () => {
      const ast = {
        op: 'AND',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '>',
            value: 1000
          },
          {
            op: 'OR',
            children: [
              {
                type: 'condition',
                field: 'visits',
                operator: '>',
                value: 5
              },
              {
                type: 'condition',
                field: 'last_order_at',
                operator: '>',
                value: '6 months ago'
              }
            ]
          }
        ]
      };
      const result = astToMongoQuery.translate(ast);
      
      expect(result).toHaveProperty('$and');
      expect(result.$and).toHaveLength(2);
      expect(result.$and[0]).toEqual({ total_spend: { $gt: 1000 } });
      expect(result.$and[1]).toHaveProperty('$or');
      expect(result.$and[1].$or).toHaveLength(2);
    });

    test('should handle date fields with relative dates', () => {
      const ast = {
        type: 'condition',
        field: 'last_order_at',
        operator: '<',
        value: '6 months ago'
      };
      const result = astToMongoQuery.translate(ast);
      
      expect(result).toHaveProperty('last_order_at');
      expect(result.last_order_at).toHaveProperty('$lt');
      expect(result.last_order_at.$lt).toBeInstanceOf(Date);
    });

    test('should handle array fields with IN operator', () => {
      const ast = {
        type: 'condition',
        field: 'emails',
        operator: 'IN',
        value: ['test@example.com', 'user@example.com']
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        emails: { $in: ['test@example.com', 'user@example.com'] }
      });
    });

    test('should handle array fields with CONTAINS operator', () => {
      const ast = {
        type: 'condition',
        field: 'emails',
        operator: 'CONTAINS',
        value: 'example.com'
      };
      const result = astToMongoQuery.translate(ast);
      expect(result).toEqual({
        emails: { $regex: 'example.com', $options: 'i' }
      });
    });

    test('should throw error for invalid operator', () => {
      const ast = {
        type: 'condition',
        field: 'total_spend',
        operator: 'INVALID',
        value: 1000
      };
      expect(() => astToMongoQuery.translate(ast)).toThrow('Unsupported operator: INVALID');
    });

    test('should throw error for invalid logical operator', () => {
      const ast = {
        op: 'INVALID',
        children: []
      };
      expect(() => astToMongoQuery.translate(ast)).toThrow('Unsupported logical operator: INVALID');
    });

    test('should throw error for NOT with multiple children', () => {
      const ast = {
        op: 'NOT',
        children: [
          { type: 'condition', field: 'a', operator: '=', value: 1 },
          { type: 'condition', field: 'b', operator: '=', value: 2 }
        ]
      };
      expect(() => astToMongoQuery.translate(ast)).toThrow('NOT operator requires exactly one child');
    });
  });

  describe('parseDateValue', () => {
    test('should parse "6 months ago"', () => {
      const result = astToMongoQuery.parseDateValue('6 months ago');
      expect(result).toBeInstanceOf(Date);
      
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Allow for small time differences
      expect(Math.abs(result.getTime() - sixMonthsAgo.getTime())).toBeLessThan(1000);
    });

    test('should parse "30 days ago"', () => {
      const result = astToMongoQuery.parseDateValue('30 days ago');
      expect(result).toBeInstanceOf(Date);
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      expect(Math.abs(result.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(1000);
    });

    test('should parse "2 weeks ago"', () => {
      const result = astToMongoQuery.parseDateValue('2 weeks ago');
      expect(result).toBeInstanceOf(Date);
      
      const now = new Date();
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      expect(Math.abs(result.getTime() - twoWeeksAgo.getTime())).toBeLessThan(1000);
    });

    test('should parse ISO date string', () => {
      const isoDate = '2023-01-01T00:00:00Z';
      const result = astToMongoQuery.parseDateValue(isoDate);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2023-01-01T00:00:00.000Z');
    });

    test('should handle Date object', () => {
      const date = new Date('2023-01-01');
      const result = astToMongoQuery.parseDateValue(date);
      expect(result).toBe(date);
    });

    test('should throw error for invalid date', () => {
      expect(() => astToMongoQuery.parseDateValue('invalid date')).toThrow('Invalid date value: invalid date');
    });
  });
});
