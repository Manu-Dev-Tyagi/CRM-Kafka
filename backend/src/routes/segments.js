// backend/src/routes/segments.js

const segmentModel = require('../models/Segment');
const leadModel = require('../models/Lead');
const astToMongoQuery = require('../utils/astToMongoQuery');

async function segmentsRoutes(fastify, options) {
  // -----------------------
  // Validation Schemas
  // -----------------------
  const ruleASTSchema = {
    type: 'object',
    properties: {
      op: { type: 'string', enum: ['AND', 'OR', 'NOT'] },
      children: { type: 'array' },
      type: { type: 'string', enum: ['condition'] },
      field: { type: 'string' },
      operator: {
        type: 'string',
        enum: ['=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS']
      },
      value: {}
    }
  };

  const segmentSchema = {
    type: 'object',
    required: ['name', 'owner_user_id', 'rule_ast'],
    properties: {
      name: { type: 'string', minLength: 1 },
      owner_user_id: { type: 'string' },
      rule_ast: ruleASTSchema
    }
  };

  const previewSchema = {
    type: 'object',
    required: ['rule_ast'],
    properties: {
      rule_ast: ruleASTSchema
    }
  };

  // -----------------------
  // Routes
  // -----------------------

  // Create Segment
  fastify.post('/', {
    schema: { body: segmentSchema }
  }, async (request, reply) => {
    try {
      const { name, owner_user_id, rule_ast } = request.body;

      if (!astToMongoQuery.validateAST(rule_ast)) {
        return reply.code(400).send({ success: false, error: 'Invalid rule AST structure' });
      }

      try {
        astToMongoQuery.translate(rule_ast);
      } catch (error) {
        return reply.code(400).send({ success: false, error: `Invalid rule AST: ${error.message}` });
      }

      const segment = await segmentModel.create({ name, owner_user_id, rule_ast });

      return reply.code(201).send({
        success: true,
        data: {
          _id: segment._id.toString(),
          name: segment.name,
          owner_user_id: segment.owner_user_id,
          rule_ast: segment.rule_ast,
          created_at: segment.created_at.toISOString()
        }
      });
    } catch (error) {
      fastify.log.error('Create segment error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to create segment' });
    }
  });

  // Preview Segment
  fastify.post('/preview', {
    schema: { body: previewSchema }
  }, async (request, reply) => {
    try {
      const { rule_ast } = request.body;

      if (!astToMongoQuery.validateAST(rule_ast)) {
        return reply.code(400).send({ success: false, error: 'Invalid rule AST structure' });
      }

      let mongoQuery;
      try {
        mongoQuery = astToMongoQuery.translate(rule_ast);
      } catch (error) {
        return reply.code(400).send({ success: false, error: `Invalid rule AST: ${error.message}` });
      }

      const [count, sample] = await Promise.all([
        leadModel.count(mongoQuery),
        leadModel.findMany(mongoQuery, { limit: 10 })
      ]);

      return { success: true, data: { count, sample } };
    } catch (error) {
      fastify.log.error('Preview segment error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to preview segment' });
    }
  });

  // List Segments
  fastify.get('/', async (request, reply) => {
    try {
      const { owner_user_id, page = 1, limit = 10 } = request.query;

      const query = {};
      if (owner_user_id) query.owner_user_id = owner_user_id;

      const skip = (page - 1) * limit;

      const [segments, total] = await Promise.all([
        segmentModel.findMany(query, { limit, skip }),
        segmentModel.count(query)
      ]);

      return {
        success: true,
        data: {
          segments,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      fastify.log.error('List segments error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch segments' });
    }
  });

  // Get Single Segment
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const segment = await segmentModel.findById(id);

      if (!segment) {
        return reply.code(404).send({ success: false, error: 'Segment not found' });
      }

      return { success: true, data: segment };
    } catch (error) {
      fastify.log.error('Get segment error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch segment' });
    }
  });

  // Update Segment
  fastify.put('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const updateData = request.body;

      if (updateData.rule_ast) {
        if (!astToMongoQuery.validateAST(updateData.rule_ast)) {
          return reply.code(400).send({ success: false, error: 'Invalid rule AST structure' });
        }

        try {
          astToMongoQuery.translate(updateData.rule_ast);
        } catch (error) {
          return reply.code(400).send({ success: false, error: `Invalid rule AST: ${error.message}` });
        }
      }

      const result = await segmentModel.update(id, updateData);

      if (result.matchedCount === 0) {
        return reply.code(404).send({ success: false, error: 'Segment not found' });
      }

      return { success: true, data: { message: 'Segment updated successfully' } };
    } catch (error) {
      fastify.log.error('Update segment error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to update segment' });
    }
  });

  // Delete Segment
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const result = await segmentModel.delete(id);

      if (result.deletedCount === 0) {
        return reply.code(404).send({ success: false, error: 'Segment not found' });
      }

      return { success: true, data: { message: 'Segment deleted successfully' } };
    } catch (error) {
      fastify.log.error('Delete segment error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to delete segment' });
    }
  });
}

// ✅ Export as Fastify plugin
module.exports = segmentsRoutes;
