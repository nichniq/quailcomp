# Documentation Integration & Code Coverage

> **Purpose:** Show how to generate living documentation from tests, integrate coverage badges, and create test-driven API documentation.

---

## 1. Tests as Executable Documentation

### **Philosophy**

Tests are not just validation—they're **executable specifications** that:
- ✅ Document behavior clearly
- ✅ Can't become outdated (they run!)
- ✅ Provide usage examples
- ✅ Serve as API references

---

## 2. Generating Documentation from Tests

### **Test-to-Docs Script**

```typescript
// scripts/generate-test-docs.ts

import { readdir, readFile, writeFile } from "fs/promises"
import path from "path"

interface TestSpec {
  file: string
  suite: string
  description: string
  code: string
}

/**
 * Extract test specifications from test files
 */
async function extractTestSpecs(testDir: string): Promise<TestSpec[]> {
  const specs: TestSpec[] = []
  const files = await readdir(testDir, { recursive: true })

  for (const file of files) {
    if (!file.endsWith(".test.ts")) continue

    const fullPath = path.join(testDir, file)
    const content = await readFile(fullPath, "utf-8")

    // Extract describe blocks
    const describeMatches = content.matchAll(/describe\("([^"]+)",/g)
    let currentSuite = ""
    for (const match of describeMatches) {
      currentSuite = match[1]
    }

    // Extract test blocks with SPECIFICATION comments
    const testRegex = /\/\*\*\s*\n\s*\*\s*SPECIFICATION:\s*([^\n]+)\s*\n\s*\*\/\s*\n\s*test\("([^"]+)",\s*async\s*\(\)\s*=>\s*\{([^}]+)\}/gs

    for (const match of content.matchAll(testRegex)) {
      specs.push({
        file,
        suite: currentSuite,
        description: match[1].trim(),
        code: match[2]
      })
    }
  }

  return specs
}

/**
 * Generate markdown documentation from test specs
 */
function generateMarkdown(specs: TestSpec[]): string {
  const grouped = specs.reduce((acc, spec) => {
    if (!acc[spec.suite]) acc[spec.suite] = []
    acc[spec.suite].push(spec)
    return acc
  }, {} as Record<string, TestSpec[]>)

  let markdown = "# API Behavior Specification\n\n"
  markdown += "> Auto-generated from test suite\n\n"
  markdown += `*Last Updated: ${new Date().toISOString().split("T")[0]}*\n\n`

  for (const [suite, suiteSpecs] of Object.entries(grouped)) {
    markdown += `## ${suite}\n\n`

    for (const spec of suiteSpecs) {
      markdown += `### ✅ ${spec.description}\n\n`
      markdown += `**Verified by:** \`${spec.file}\`\n\n`
    }

    markdown += "\n---\n\n"
  }

  return markdown
}

// Generate docs
const specs = await extractTestSpecs("./tests")
const markdown = generateMarkdown(specs)
await writeFile("./docs/api-behavior.md", markdown)

console.log("✅ Generated API behavior documentation")
```

### **Example Output** (`docs/api-behavior.md`)

```markdown
# API Behavior Specification

> Auto-generated from test suite

*Last Updated: 2026-02-12*

## EntityRepository

### ✅ Create should generate a unique ID for new entities

**Verified by:** `data/client/tests/EntityRepository.test.ts`

### ✅ Create should set timestamps to current time

**Verified by:** `data/client/tests/EntityRepository.test.ts`

### ✅ Create should initialize version to 1

**Verified by:** `data/client/tests/EntityRepository.test.ts`

### ✅ GetById should retrieve existing entities

**Verified by:** `data/client/tests/EntityRepository.test.ts`

### ✅ GetById should return null for non-existent IDs

**Verified by:** `data/client/tests/EntityRepository.test.ts`

---

## AuthenticationService

### ✅ Register should create a new user with hashed password

**Verified by:** `server/tests/services/AuthenticationService.test.ts`

### ✅ Register should reject invalid email addresses

**Verified by:** `server/tests/services/AuthenticationService.test.ts`

---
```

---

## 3. API Documentation from Tests

### **Generating OpenAPI/Swagger Docs**

```typescript
// scripts/generate-api-docs.ts

import { readFile, writeFile } from "fs/promises"
import type { OpenAPIV3 } from "openapi-types"

interface TestExample {
  method: string
  path: string
  request: unknown
  response: unknown
  status: number
}

/**
 * Extract API examples from integration tests
 */
function extractAPIExamples(testContent: string): TestExample[] {
  const examples: TestExample[] = []

  // Match fetch calls in E2E tests
  const fetchRegex = /fetch\(`([^`]+)`,\s*\{[^}]*method:\s*"([A-Z]+)"[^}]*body:\s*JSON\.stringify\(([^)]+)\)[^}]*\}\)/g

  for (const match of testContent.matchAll(fetchRegex)) {
    const url = match[1]
    const method = match[2]
    const body = match[3]

    examples.push({
      method,
      path: url.replace(/.*\$\{baseUrl\}/, ""),
      request: body,
      response: null, // Would need to parse expect statements
      status: 200
    })
  }

  return examples
}

/**
 * Generate OpenAPI specification from test examples
 */
async function generateOpenAPISpec(): Promise<OpenAPIV3.Document> {
  const testFiles = await glob("tests/e2e/**/*.test.ts")

  const spec: OpenAPIV3.Document = {
    openapi: "3.0.0",
    info: {
      title: "QuailComp API",
      version: "1.0.0",
      description: "Auto-generated from E2E tests"
    },
    paths: {}
  }

  for (const file of testFiles) {
    const content = await readFile(file, "utf-8")
    const examples = extractAPIExamples(content)

    for (const example of examples) {
      if (!spec.paths[example.path]) {
        spec.paths[example.path] = {}
      }

      spec.paths[example.path][example.method.toLowerCase()] = {
        summary: `${example.method} ${example.path}`,
        requestBody: {
          content: {
            "application/json": {
              example: example.request
            }
          }
        },
        responses: {
          [example.status]: {
            description: "Successful response",
            content: {
              "application/json": {
                example: example.response
              }
            }
          }
        }
      }
    }
  }

  return spec
}

const spec = await generateOpenAPISpec()
await writeFile("./docs/openapi.json", JSON.stringify(spec, null, 2))

console.log("✅ Generated OpenAPI specification")
```

---

## 4. Coverage Badges

### **Generating Coverage Badges**

```typescript
// scripts/generate-coverage-badge.ts

import { readFile, writeFile } from "fs/promises"

interface CoverageSummary {
  lines: { pct: number }
  statements: { pct: number }
  functions: { pct: number }
  branches: { pct: number }
}

/**
 * Parse LCOV coverage report
 */
async function parseCoverage(): Promise<CoverageSummary> {
  const coverageFile = await readFile("./coverage/coverage-summary.json", "utf-8")
  const summary = JSON.parse(coverageFile)

  return {
    lines: { pct: summary.total.lines.pct },
    statements: { pct: summary.total.statements.pct },
    functions: { pct: summary.total.functions.pct },
    branches: { pct: summary.total.branches.pct }
  }
}

/**
 * Generate coverage badge markdown
 */
function generateBadge(pct: number, label: string): string {
  const color = pct >= 90 ? "brightgreen" : pct >= 70 ? "yellow" : "red"
  return `![${label}](https://img.shields.io/badge/${label}-${pct.toFixed(1)}%25-${color})`
}

/**
 * Update README with coverage badges
 */
async function updateReadmeWithBadges() {
  const coverage = await parseCoverage()

  const badges = [
    generateBadge(coverage.lines.pct, "Lines"),
    generateBadge(coverage.statements.pct, "Statements"),
    generateBadge(coverage.functions.pct, "Functions"),
    generateBadge(coverage.branches.pct, "Branches")
  ].join(" ")

  const readme = await readFile("./README.md", "utf-8")

  // Replace coverage badges section
  const updated = readme.replace(
    /<!-- COVERAGE-BADGES-START -->[\s\S]*<!-- COVERAGE-BADGES-END -->/,
    `<!-- COVERAGE-BADGES-START -->\n${badges}\n<!-- COVERAGE-BADGES-END -->`
  )

  await writeFile("./README.md", updated)

  console.log("✅ Updated README with coverage badges")
}

await updateReadmeWithBadges()
```

### **README.md with Badges**

```markdown
# QuailComp

<!-- COVERAGE-BADGES-START -->
![Lines](https://img.shields.io/badge/Lines-98.5%25-brightgreen)
![Statements](https://img.shields.io/badge/Statements-97.2%25-brightgreen)
![Functions](https://img.shields.io/badge/Functions-95.8%25-brightgreen)
![Branches](https://img.shields.io/badge/Branches-92.3%25-brightgreen)
<!-- COVERAGE-BADGES-END -->

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen)]()

...
```

---

## 5. Test Coverage Reports

### **HTML Coverage Report**

```bash
# Generate HTML coverage report
bun test --coverage --coverage-reporter=html

# Open in browser
open coverage/index.html
```

**Coverage Report Features:**
- ✅ Line-by-line coverage visualization
- ✅ Branch coverage highlighting
- ✅ Uncovered code sections
- ✅ Per-file coverage percentages
- ✅ Drill-down to specific files

### **Coverage Dashboard** (`coverage/index.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Coverage Report</title>
  <style>
    .covered { background-color: #c8e6c9; }
    .uncovered { background-color: #ffcdd2; }
    .partial { background-color: #fff9c4; }
  </style>
</head>
<body>
  <h1>Coverage Summary</h1>
  <table>
    <tr>
      <th>Metric</th>
      <th>Covered</th>
      <th>Total</th>
      <th>Percentage</th>
    </tr>
    <tr>
      <td>Lines</td>
      <td>1,234</td>
      <td>1,254</td>
      <td class="covered">98.5%</td>
    </tr>
    <tr>
      <td>Branches</td>
      <td>456</td>
      <td>494</td>
      <td class="covered">92.3%</td>
    </tr>
  </table>

  <h2>Files</h2>
  <ul>
    <li><a href="data/client/EntityRepository.html">EntityRepository.ts</a> - 100%</li>
    <li><a href="server/services/AuthenticationService.html">AuthenticationService.ts</a> - 95.2%</li>
  </ul>
</body>
</html>
```

---

## 6. Coverage Tracking Over Time

### **Coverage History Script**

```typescript
// scripts/track-coverage-history.ts

import { readFile, writeFile, appendFile } from "fs/promises"

interface CoverageSnapshot {
  date: string
  lines: number
  statements: number
  functions: number
  branches: number
  commit?: string
}

/**
 * Record current coverage snapshot
 */
async function recordCoverageSnapshot() {
  const coverageFile = await readFile("./coverage/coverage-summary.json", "utf-8")
  const summary = JSON.parse(coverageFile)

  const snapshot: CoverageSnapshot = {
    date: new Date().toISOString().split("T")[0],
    lines: summary.total.lines.pct,
    statements: summary.total.statements.pct,
    functions: summary.total.functions.pct,
    branches: summary.total.branches.pct,
    commit: process.env.GITHUB_SHA ?? await getGitCommitHash()
  }

  // Append to history CSV
  const csv = `${snapshot.date},${snapshot.lines},${snapshot.statements},${snapshot.functions},${snapshot.branches},${snapshot.commit}\n`
  await appendFile("./coverage/history.csv", csv)

  console.log("✅ Recorded coverage snapshot:", snapshot)
}

async function getGitCommitHash(): Promise<string> {
  const { stdout } = await Bun.spawn(["git", "rev-parse", "HEAD"]).exited
  return stdout.toString().trim()
}

await recordCoverageSnapshot()
```

### **Coverage History** (`coverage/history.csv`)

```csv
date,lines,statements,functions,branches,commit
2026-02-01,85.2,84.1,82.5,79.8,abc123
2026-02-05,89.5,88.3,86.2,83.1,def456
2026-02-10,94.2,93.1,91.5,88.6,ghi789
2026-02-12,98.5,97.2,95.8,92.3,jkl012
```

### **Visualizing Coverage Trends**

```typescript
// scripts/generate-coverage-chart.ts

import { readFile, writeFile } from "fs/promises"

async function generateCoverageChart() {
  const history = await readFile("./coverage/history.csv", "utf-8")
  const rows = history.trim().split("\n").slice(1) // Skip header

  const dates = rows.map(r => r.split(",")[0])
  const lines = rows.map(r => parseFloat(r.split(",")[1]))

  const chartHtml = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <canvas id="coverageChart"></canvas>
  <script>
    new Chart(document.getElementById('coverageChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(dates)},
        datasets: [{
          label: 'Line Coverage',
          data: ${JSON.stringify(lines)},
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: false,
            min: 70,
            max: 100
          }
        }
      }
    });
  </script>
</body>
</html>
  `

  await writeFile("./coverage/trend.html", chartHtml)

  console.log("✅ Generated coverage trend chart")
}

await generateCoverageChart()
```

---

## 7. Living Documentation

### **Auto-Generated API Reference**

```typescript
// scripts/generate-api-reference.ts

import { readdir, readFile, writeFile } from "fs/promises"
import path from "path"

interface MethodDoc {
  name: string
  description: string
  behaviors: string[]
  examples: string[]
  coverage: number
}

/**
 * Parse test file to extract method documentation
 */
async function parseTestFile(filePath: string): Promise<MethodDoc[]> {
  const content = await readFile(filePath, "utf-8")
  const docs: MethodDoc[] = []

  // Extract method from describe blocks
  const methodRegex = /describe\("(\w+)",[\s\S]*?\{([\s\S]*?)\n\}\)/g

  for (const methodMatch of content.matchAll(methodRegex)) {
    const methodName = methodMatch[1]
    const methodBody = methodMatch[2]

    // Extract behaviors from SPECIFICATION comments
    const behaviors: string[] = []
    const behaviorRegex = /SPECIFICATION:\s*([^\n]+)/g

    for (const behaviorMatch of methodBody.matchAll(behaviorRegex)) {
      behaviors.push(behaviorMatch[1].trim())
    }

    // Extract example code from tests
    const examples: string[] = []
    const exampleRegex = /test\("[^"]+",[\s\S]*?\{([\s\S]*?)\n\s*\}\)/g

    for (const exampleMatch of methodBody.matchAll(exampleRegex)) {
      examples.push(exampleMatch[1].trim())
    }

    docs.push({
      name: methodName,
      description: `${methodName} method`,
      behaviors,
      examples: examples.slice(0, 2), // First 2 examples
      coverage: 0 // Would parse from coverage report
    })
  }

  return docs
}

/**
 * Generate markdown API reference
 */
function generateAPIReference(docs: MethodDoc[]): string {
  let markdown = "# API Reference\n\n"
  markdown += "> Auto-generated from test suite\n\n"

  for (const method of docs) {
    markdown += `## ${method.name}\n\n`
    markdown += `${method.description}\n\n`

    markdown += "**Behavior:**\n"
    for (const behavior of method.behaviors) {
      markdown += `- ✅ ${behavior}\n`
    }
    markdown += "\n"

    if (method.examples.length > 0) {
      markdown += "**Example:**\n```typescript\n"
      markdown += method.examples[0]
      markdown += "\n```\n\n"
    }

    markdown += `*Coverage: ${method.coverage}%*\n\n`
    markdown += "---\n\n"
  }

  return markdown
}

// Generate API reference
const testFiles = await glob("tests/integration/**/*.test.ts")
const allDocs: MethodDoc[] = []

for (const file of testFiles) {
  const docs = await parseTestFile(file)
  allDocs.push(...docs)
}

const markdown = generateAPIReference(allDocs)
await writeFile("./docs/api-reference.md", markdown)

console.log("✅ Generated API reference documentation")
```

---

## 8. Pre-Commit Coverage Check

### **Git Hook** (`.githooks/pre-commit`)

```bash
#!/bin/bash

# Run tests with coverage
echo "Running tests with coverage..."
bun test --coverage --coverage-reporter=json > /dev/null

# Parse coverage percentage
COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)

# Check threshold (90%)
THRESHOLD=90

if (( $(echo "$COVERAGE < $THRESHOLD" | bc -l) )); then
  echo "❌ Coverage is below threshold: $COVERAGE% < $THRESHOLD%"
  exit 1
fi

echo "✅ Coverage check passed: $COVERAGE%"
```

---

## 9. CI/CD Integration

### **GitHub Actions** (`.github/workflows/test.yml`)

```yaml
name: Test & Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests with coverage
        run: bun test --coverage --coverage-reporter=json --coverage-reporter=html

      - name: Generate coverage badge
        run: bun run scripts/generate-coverage-badge.ts

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Generate API docs
        run: bun run scripts/generate-api-docs.ts

      - name: Commit updated docs
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add docs/ README.md
          git commit -m "Update auto-generated documentation [skip ci]" || true
          git push
```

---

## Summary

**Documentation integration provides:**

1. ✅ **Living documentation** - Auto-generated from tests
2. ✅ **Coverage tracking** - Historical trends and dashboards
3. ✅ **API references** - Extracted from test specifications
4. ✅ **Coverage badges** - Visual indicators in README
5. ✅ **CI/CD integration** - Automated documentation updates
6. ✅ **Pre-commit checks** - Enforce coverage thresholds

**Best Practices:**

- Document behavior in tests with `/** SPECIFICATION: ... */` comments
- Generate documentation as part of CI/CD pipeline
- Track coverage over time to spot regressions
- Use badges to communicate quality metrics
- Keep documentation synchronized with tests

---

**Version:** 1.0.0
**Last Updated:** 2026-02-12
**Status:** ⭐️ Phase 0.2 - Testing Strategy & Infrastructure
