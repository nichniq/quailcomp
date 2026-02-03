/**
 * ESLint rule to enforce parameterized SQL queries using Bun's tagged templates
 *
 * Prevents SQL injection vulnerabilities by ensuring all SQL queries use
 * Bun's SQL tagged template syntax (e.g., `sql\`SELECT * FROM users WHERE id = \${id}\``)
 * instead of string concatenation or regular template literals.
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce parameterized SQL queries using Bun tagged templates',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noStringSql:
        'SQL queries must use Bun tagged templates (sql`...`) instead of strings to prevent SQL injection',
      noTemplateLiteralSql:
        'SQL queries must use tagged templates (sql`...`) instead of regular template literals to ensure proper parameterization',
      noStringConcatenation:
        'SQL queries must not use string concatenation. Use Bun tagged templates (sql`...`) with ${} for parameters',
    },
    schema: [],
  },

  create(context) {
    // SQL-related method names that should only accept tagged templates
    const SQL_METHODS = new Set(['query', 'execute', 'run', 'all', 'get']);

    // SQL keywords that indicate a query (case-insensitive)
    const SQL_KEYWORDS = /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|WITH)\s+/i;

    /**
     * Check if a node is a SQL tagged template (e.g., sql`...` or this.sql`...`)
     */
    function isSqlTaggedTemplate(node) {
      if (node.type !== 'TaggedTemplateExpression') {
        return false;
      }

      const tag = node.tag;

      // Check for direct sql`` usage
      if (tag.type === 'Identifier' && tag.name === 'sql') {
        return true;
      }

      // Check for this.sql`` or tx`` usage
      if (tag.type === 'MemberExpression') {
        const property = tag.property;
        if (property.type === 'Identifier' && property.name === 'sql') {
          return true;
        }
      }

      // Check for transaction variable patterns like tx``
      if (tag.type === 'Identifier' && tag.name === 'tx') {
        return true;
      }

      return false;
    }

    /**
     * Check if a string literal contains SQL keywords
     */
    function looksLikeSql(value) {
      if (typeof value !== 'string') {
        return false;
      }
      return SQL_KEYWORDS.test(value);
    }

    /**
     * Check if a template literal contains SQL keywords
     */
    function templateLooksLikeSql(node) {
      if (node.type !== 'TemplateLiteral') {
        return false;
      }

      const firstQuasi = node.quasis[0];
      if (!firstQuasi) {
        return false;
      }

      return looksLikeSql(firstQuasi.value.raw);
    }

    /**
     * Check for string concatenation that might be SQL
     */
    function checkBinaryExpression(node) {
      if (node.operator !== '+') {
        return;
      }

      let hasStringLiteral = false;
      let containsSql = false;

      function checkNode(n) {
        if (n.type === 'Literal' && typeof n.value === 'string') {
          hasStringLiteral = true;
          if (looksLikeSql(n.value)) {
            containsSql = true;
          }
        } else if (n.type === 'BinaryExpression' && n.operator === '+') {
          checkNode(n.left);
          checkNode(n.right);
        }
      }

      checkNode(node);

      if (hasStringLiteral && containsSql) {
        context.report({
          node,
          messageId: 'noStringConcatenation',
        });
      }
    }

    /**
     * Check method calls that might be SQL-related
     */
    function checkCallExpression(node) {
      const callee = node.callee;

      // Check for sql-related method calls
      if (callee.type === 'MemberExpression') {
        const property = callee.property;
        if (
          property.type === 'Identifier' &&
          SQL_METHODS.has(property.name)
        ) {
          const firstArg = node.arguments[0];
          if (!firstArg) {
            return;
          }

          // Check if argument is a string literal with SQL
          if (firstArg.type === 'Literal' && looksLikeSql(firstArg.value)) {
            context.report({
              node: firstArg,
              messageId: 'noStringSql',
            });
          }

          // Check if argument is a template literal (not tagged)
          if (templateLooksLikeSql(firstArg)) {
            context.report({
              node: firstArg,
              messageId: 'noTemplateLiteralSql',
            });
          }
        }
      }
    }

    /**
     * Check variable declarations for SQL strings
     */
    function checkVariableDeclarator(node) {
      if (!node.init) {
        return;
      }

      // Check for SQL string literals
      if (node.init.type === 'Literal' && looksLikeSql(node.init.value)) {
        context.report({
          node: node.init,
          messageId: 'noStringSql',
        });
      }

      // Check for SQL template literals (not tagged)
      if (templateLooksLikeSql(node.init)) {
        context.report({
          node: node.init,
          messageId: 'noTemplateLiteralSql',
        });
      }
    }

    return {
      BinaryExpression: checkBinaryExpression,
      CallExpression: checkCallExpression,
      VariableDeclarator: checkVariableDeclarator,
    };
  },
};
