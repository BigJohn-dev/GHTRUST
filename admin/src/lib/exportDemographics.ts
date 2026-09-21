import type { DashboardDemographics, DemographicBucket } from './dashboardApi'

function escapeCsv(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function demographicsToCsv(demo: DashboardDemographics): string {
  const lines = ['Section,Label,Count,Percentage']
  const sections: Array<[string, DemographicBucket[]]> = [
    ['Gender', demo.gender],
    ['Age', demo.age_buckets],
    ['State of residence', demo.state_of_residence],
    ['State of origin', demo.state_of_origin],
  ]

  for (const [section, buckets] of sections) {
    for (const bucket of buckets) {
      lines.push(
        [section, bucket.label, bucket.count, bucket.percentage].map(escapeCsv).join(','),
      )
    }
  }
  lines.push('')
  lines.push(`Total applicants,${demo.total_applicants},,`)
  return lines.join('\n')
}

export function downloadDemographicsCsv(demo: DashboardDemographics, filename = 'gh-trust-demographics.csv') {
  const csv = demographicsToCsv(demo)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
