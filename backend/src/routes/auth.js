// Auth routes stub - will be implemented in later parts
async function authRoutes(fastify, options) {
  // GET /api/auth/google - Google OAuth login (stub)
  fastify.get('/google', async (request, reply) => {
    return reply.code(501).send({
      success: false,
      error: 'Google OAuth not implemented yet',
      message: 'This will redirect to Google OAuth in a future implementation'
    });
  });

  // GET /api/auth/google/callback - Google OAuth callback (stub)
  fastify.get('/google/callback', async (request, reply) => {
    return reply.code(501).send({
      success: false,
      error: 'Google OAuth callback not implemented yet',
      message: 'This will handle OAuth callback in a future implementation'
    });
  });

  // POST /api/auth/logout - Logout (stub)
  fastify.post('/logout', async (request, reply) => {
    return reply.code(501).send({
      success: false,
      error: 'Logout not implemented yet',
      message: 'This will handle logout in a future implementation'
    });
  });

  // GET /api/auth/me - Get current user (stub)
  fastify.get('/me', async (request, reply) => {
    return reply.code(501).send({
      success: false,
      error: 'User authentication not implemented yet',
      message: 'This will return current user info in a future implementation'
    });
  });
}

module.exports = authRoutes;
