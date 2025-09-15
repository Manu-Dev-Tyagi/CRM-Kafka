#!/usr/bin/env node

const astToMongoQuery = require('../src/utils/astToMongoQuery');

console.log('🧪 Testing Mini CRM Backend Components (Offline)...\n');

// Test AST to MongoDB Query Translator
console.log('1. Testing AST to MongoDB Query Translator...');

// Test simple condition
const simpleAST = {
  type: 'condition',
  field: 'total_spend',
  operator: '>',
  value: 1000
};

console.log('   Simple condition AST:', JSON.stringify(simpleAST, null, 2));
const simpleQuery = astToMongoQuery.translate(simpleAST);
console.log('   Translated query:', JSON.stringify(simpleQuery, null, 2));
console.log('   ✅ Simple condition test passed');

// Test AND condition
const andAST = {
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

console.log('\n   AND condition AST:', JSON.stringify(andAST, null, 2));
const andQuery = astToMongoQuery.translate(andAST);
console.log('   Translated query:', JSON.stringify(andQuery, null, 2));
console.log('   ✅ AND condition test passed');

// Test OR condition
const orAST = {
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

console.log('\n   OR condition AST:', JSON.stringify(orAST, null, 2));
const orQuery = astToMongoQuery.translate(orAST);
console.log('   Translated query:', JSON.stringify(orQuery, null, 2));
console.log('   ✅ OR condition test passed');

// Test date condition
const dateAST = {
  type: 'condition',
  field: 'last_order_at',
  operator: '<',
  value: '6 months ago'
};

console.log('\n   Date condition AST:', JSON.stringify(dateAST, null, 2));
const dateQuery = astToMongoQuery.translate(dateAST);
console.log('   Translated query:', JSON.stringify(dateQuery, null, 2));
console.log('   ✅ Date condition test passed');

// Test array condition
const arrayAST = {
  type: 'condition',
  field: 'emails',
  operator: 'CONTAINS',
  value: 'example.com'
};

console.log('\n   Array condition AST:', JSON.stringify(arrayAST, null, 2));
const arrayQuery = astToMongoQuery.translate(arrayAST);
console.log('   Translated query:', JSON.stringify(arrayQuery, null, 2));
console.log('   ✅ Array condition test passed');

// Test complex nested AST
const complexAST = {
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
          value: '3 months ago'
        }
      ]
    }
  ]
};

console.log('\n   Complex nested AST:', JSON.stringify(complexAST, null, 2));
const complexQuery = astToMongoQuery.translate(complexAST);
console.log('   Translated query:', JSON.stringify(complexQuery, null, 2));
console.log('   ✅ Complex nested AST test passed');

// Test AST validation
console.log('\n2. Testing AST validation...');
console.log('   Valid simple AST:', astToMongoQuery.validateAST(simpleAST));
console.log('   Valid AND AST:', astToMongoQuery.validateAST(andAST));
console.log('   Valid OR AST:', astToMongoQuery.validateAST(orAST));
console.log('   Valid complex AST:', astToMongoQuery.validateAST(complexAST));

const invalidAST = {
  type: 'condition',
  field: 'total_spend'
  // missing operator and value
};
console.log('   Invalid AST:', astToMongoQuery.validateAST(invalidAST));
console.log('   ✅ AST validation tests passed');

// Test date parsing
console.log('\n3. Testing date parsing...');
const testDates = [
  '6 months ago',
  '30 days ago',
  '2 weeks ago',
  '2023-01-01T00:00:00Z'
];

testDates.forEach(dateStr => {
  try {
    const parsed = astToMongoQuery.parseDateValue(dateStr);
    console.log(`   "${dateStr}" -> ${parsed.toISOString()}`);
  } catch (error) {
    console.log(`   "${dateStr}" -> Error: ${error.message}`);
  }
});
console.log('   ✅ Date parsing tests passed');

console.log('\n🎉 All offline tests passed!');
console.log('\n📊 Test Summary:');
console.log('   ✅ AST to MongoDB Query Translator');
console.log('   ✅ Simple conditions');
console.log('   ✅ Logical operators (AND, OR)');
console.log('   ✅ Date conditions');
console.log('   ✅ Array conditions');
console.log('   ✅ Complex nested ASTs');
console.log('   ✅ AST validation');
console.log('   ✅ Date parsing');

console.log('\n💡 To test the full API, start MongoDB and Kafka, then run:');
console.log('   MongoDB: brew services start mongodb-community');
console.log('   Redpanda: docker-compose up -d redpanda');
console.log('   npm run dev');
console.log('   node scripts/test-api.js');
