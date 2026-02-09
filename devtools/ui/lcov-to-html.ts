/**
 * Simple LCOV to HTML converter
 * Parses lcov.info and generates a basic HTML coverage report
 */

interface FileCoverage {
  file: string
  lines: { found: number; hit: number }
  functions: { found: number; hit: number }
  branches: { found: number; hit: number }
}

export function parseLcov(lcovContent: string): FileCoverage[] {
  const files: FileCoverage[] = []
  let currentFile: FileCoverage | null = null

  const lines = lcovContent.split('\n')

  for (const line of lines) {
    if (line.startsWith('SF:')) {
      // Start of file
      currentFile = {
        file: line.substring(3),
        lines: { found: 0, hit: 0 },
        functions: { found: 0, hit: 0 },
        branches: { found: 0, hit: 0 },
      }
    } else if (line.startsWith('LF:')) {
      // Lines found
      if (currentFile) currentFile.lines.found = parseInt(line.substring(3))
    } else if (line.startsWith('LH:')) {
      // Lines hit
      if (currentFile) currentFile.lines.hit = parseInt(line.substring(3))
    } else if (line.startsWith('FNF:')) {
      // Functions found
      if (currentFile) currentFile.functions.found = parseInt(line.substring(4))
    } else if (line.startsWith('FNH:')) {
      // Functions hit
      if (currentFile) currentFile.functions.hit = parseInt(line.substring(4))
    } else if (line.startsWith('BRF:')) {
      // Branches found
      if (currentFile) currentFile.branches.found = parseInt(line.substring(4))
    } else if (line.startsWith('BRH:')) {
      // Branches hit
      if (currentFile) currentFile.branches.hit = parseInt(line.substring(4))
    } else if (line === 'end_of_record') {
      // End of file record
      if (currentFile) {
        files.push(currentFile)
        currentFile = null
      }
    }
  }

  return files
}

function calculatePercentage(hit: number, found: number): number {
  if (found === 0) return 100
  return Math.round((hit / found) * 100 * 10) / 10
}

function getColorClass(percentage: number): string {
  if (percentage >= 80) return 'high'
  if (percentage >= 50) return 'medium'
  return 'low'
}

export function generateHtml(files: FileCoverage[]): string {
  const totalStats = files.reduce(
    (acc, file) => ({
      lines: { found: acc.lines.found + file.lines.found, hit: acc.lines.hit + file.lines.hit },
      functions: { found: acc.functions.found + file.functions.found, hit: acc.functions.hit + file.functions.hit },
      branches: { found: acc.branches.found + file.branches.found, hit: acc.branches.hit + file.branches.hit },
    }),
    { lines: { found: 0, hit: 0 }, functions: { found: 0, hit: 0 }, branches: { found: 0, hit: 0 } }
  )

  const linesPercent = calculatePercentage(totalStats.lines.hit, totalStats.lines.found)
  const functionsPercent = calculatePercentage(totalStats.functions.hit, totalStats.functions.found)
  const branchesPercent = calculatePercentage(totalStats.branches.hit, totalStats.branches.found)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Coverage Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 2rem 0; color: #333; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat { background: #f8f9fa; padding: 1rem; border-radius: 4px; border-left: 4px solid #ddd; }
    .stat.high { border-left-color: #28a745; }
    .stat.medium { border-left-color: #ffc107; }
    .stat.low { border-left-color: #dc3545; }
    .stat-label { font-size: 0.85rem; color: #666; margin-bottom: 0.5rem; }
    .stat-value { font-size: 1.5rem; font-weight: bold; color: #333; }
    .stat-detail { font-size: 0.85rem; color: #999; margin-top: 0.25rem; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 0.75rem; background: #f8f9fa; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057; }
    td { padding: 0.75rem; border-bottom: 1px solid #dee2e6; }
    tr:hover { background: #f8f9fa; }
    .file-path { font-family: 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 0.9rem; }
    .percentage { font-weight: 600; }
    .percentage.high { color: #28a745; }
    .percentage.medium { color: #856404; }
    .percentage.low { color: #dc3545; }
    .bar { height: 20px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: #28a745; transition: width 0.3s; }
    .bar-fill.medium { background: #ffc107; }
    .bar-fill.low { background: #dc3545; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Code Coverage Report</h1>

    <div class="summary">
      <div class="stat ${getColorClass(linesPercent)}">
        <div class="stat-label">Lines</div>
        <div class="stat-value">${linesPercent}%</div>
        <div class="stat-detail">${totalStats.lines.hit} / ${totalStats.lines.found}</div>
      </div>
      <div class="stat ${getColorClass(functionsPercent)}">
        <div class="stat-label">Functions</div>
        <div class="stat-value">${functionsPercent}%</div>
        <div class="stat-detail">${totalStats.functions.hit} / ${totalStats.functions.found}</div>
      </div>
      <div class="stat ${getColorClass(branchesPercent)}">
        <div class="stat-label">Branches</div>
        <div class="stat-value">${branchesPercent}%</div>
        <div class="stat-detail">${totalStats.branches.hit} / ${totalStats.branches.found}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>File</th>
          <th style="width: 120px;">Lines</th>
          <th style="width: 120px;">Functions</th>
          <th style="width: 120px;">Branches</th>
        </tr>
      </thead>
      <tbody>
        ${files
    .map((file) => {
      const linesPct = calculatePercentage(file.lines.hit, file.lines.found)
      const funcsPct = calculatePercentage(file.functions.hit, file.functions.found)
      const branchesPct = calculatePercentage(file.branches.hit, file.branches.found)
      return `
        <tr>
          <td class="file-path">${file.file}</td>
          <td>
            <div class="percentage ${getColorClass(linesPct)}">${linesPct}%</div>
            <div class="bar"><div class="bar-fill ${getColorClass(linesPct)}" style="width: ${linesPct}%"></div></div>
          </td>
          <td>
            <div class="percentage ${getColorClass(funcsPct)}">${funcsPct}%</div>
            <div class="bar"><div class="bar-fill ${getColorClass(funcsPct)}" style="width: ${funcsPct}%"></div></div>
          </td>
          <td>
            <div class="percentage ${getColorClass(branchesPct)}">${branchesPct}%</div>
            <div class="bar"><div class="bar-fill ${getColorClass(branchesPct)}" style="width: ${branchesPct}%"></div></div>
          </td>
        </tr>`
    })
    .join('')}
      </tbody>
    </table>

    <p style="margin-top: 2rem; color: #999; font-size: 0.85rem;">
      Generated by Quailcomp DevTools • ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>`
}
