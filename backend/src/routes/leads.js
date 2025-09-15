const leadModel = require('../models/Lead');
const { v4: uuidv4 } = require('uuid');

async function leadsRoutes(fastify, options) {
  // Validation schemas
  const leadSchema = {
    type: 'object',
    required: ['name', 'emails'],
    properties: {
      name: { type: 'string', minLength: 1 },
      emails: { 
        type: 'array', 
        items: { type: 'string', format: 'email' },
        minItems: 1
      },
      phones: { 
        type: 'array', 
        items: { type: 'string' }
      },
      total_spend: { type: 'number', minimum: 0 },
      visits: { type: 'number', minimum: 0 },
      last_order_at: { type: 'string', format: 'date-time' },
      metadata: { type: 'object' }
    }
  };

  const bulkLeadsSchema = {
    type: 'object',
    required: ['leads'],
    properties: {
      leads: {
        type: 'array',
        items: leadSchema,
        minItems: 1,
        maxItems: 1000 // Limit bulk operations
      }
    }
  };

  // POST /api/v1/leads/bulk - Bulk insert/update leads
  fastify.post('/bulk', {
    schema: {
      body: bulkLeadsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accepted: { type: 'number' },
                inserted: { type: 'number' },
                modified: { type: 'number' },
                matched: { type: 'number' },
                jobId: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { leads } = request.body;
      
      // Validate leads
      const validLeads = leads.filter(lead => {
        return lead.name && lead.emails && lead.emails.length > 0;
      });

      if (validLeads.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'No valid leads provided'
        });
      }

      // Perform bulk upsert
      const result = await leadModel.bulkUpsert(validLeads);
      
      const jobId = uuidv4();
      
      return {
        success: true,
        data: {
          accepted: validLeads.length,
          inserted: result.inserted,
          modified: result.modified,
          matched: result.matched,
          jobId
        }
      };
    } catch (error) {
      // Log the full error object for better debugging
      fastify.log.error('Bulk leads error:', error);
      console.error('Detailed Error:', error); 
      return reply.code(500).send({
        success: false,
        error: 'Failed to process bulk leads'
      });
    }
  });

  // GET /api/v1/leads - List leads with pagination and filtering
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
          search: { type: 'string' },
          min_spend: { type: 'number', minimum: 0 },
          max_spend: { type: 'number', minimum: 0 },
          sort_by: { type: 'string', enum: ['name', 'total_spend', 'visits', 'created_at'], default: 'created_at' },
          sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        min_spend, 
        max_spend, 
        sort_by = 'created_at', 
        sort_order = 'desc' 
      } = request.query;

      // Build query
      const query = {};
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { emails: { $regex: search, $options: 'i' } },
          { phones: { $regex: search, $options: 'i' } }
        ];
      }

      if (min_spend !== undefined || max_spend !== undefined) {
        query.total_spend = {};
        if (min_spend !== undefined) query.total_spend.$gte = min_spend;
        if (max_spend !== undefined) query.total_spend.$lte = max_spend;
      }

      // Build sort
      const sort = {};
      sort[sort_by] = sort_order === 'asc' ? 1 : -1;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get leads and count
      const [leads, total] = await Promise.all([
        leadModel.findMany(query, { limit, skip, sort }),
        leadModel.count(query)
      ]);

      return {
        success: true,
        data: {
          leads,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      fastify.log.error('List leads error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch leads'
      });
    }
  });

  // GET /api/v1/leads/:id - Get single lead
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      const lead = await leadModel.findById(id);
      
      if (!lead) {
        return reply.code(404).send({
          success: false,
          error: 'Lead not found'
        });
      }

      return {
        success: true,
        data: lead
      };
    } catch (error) {
      fastify.log.error('Get lead error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch lead'
      });
    }
  });

  // POST /api/v1/leads - Create single lead
  fastify.post('/', {
    schema: { body: leadSchema }
  }, async (request, reply) => {
    try {
      const leadData = request.body;
      const lead = await leadModel.create(leadData);
      return reply.code(201).send({ success: true, data: lead });
    } catch (error) {
      fastify.log.error('❌ Create lead error:', error);  // LOG REAL ERROR
      return reply.code(500).send({
        success: false,
        error: error.message   // RETURN REAL ERROR INSTEAD OF GENERIC MESSAGE
      });
    }
  });
  
}

module.exports = leadsRoutes;