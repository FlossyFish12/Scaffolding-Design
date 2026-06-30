import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export type ReportStructure = {
  structureId: string
  structureName: string
  zones: Array<{
    label: string
    scaffoldType: string
    labourItems: Array<{ description: string; quantity: number; unit: string; unitManhours: number }>
    materialItems: Array<{ description: string; quantity: number; unit: string }>
    zoneManhours: number
  }>
  structureManhours: number
}

export type EstimateReportProps = {
  projectNumber: string
  title: string
  client: string
  date: string
  structures: ReportStructure[]
  totalManhours: number
  durationWeeks: number
  peakWeeklyDemand: number
  materialsByType: Array<{ description: string; quantity: number; unit: string }>
}

const S = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a1a' },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#0D1B2A', paddingBottom: 10 },
  headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0D1B2A' },
  headerSub: { fontSize: 10, color: '#555', marginTop: 3 },
  green: { color: '#00B451', fontFamily: 'Helvetica-Bold' },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0D1B2A', marginTop: 16, marginBottom: 6 },
  zoneTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4 },
  categoryLabel: { fontSize: 8, color: '#666', marginBottom: 3 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F2F5F9',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  col3: { flex: 1 },
  col4: { flex: 1, textAlign: 'right' },
  col5: { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  summary: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F2F5F9',
    borderLeftWidth: 3,
    borderLeftColor: '#00B451',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { color: '#555' },
  summaryValue: { fontFamily: 'Helvetica-Bold' },
})

function TableHeader({ labour }: { labour: boolean }) {
  return (
    <View style={S.tableHeader}>
      <Text style={S.col1}>Description</Text>
      <Text style={S.col2}>Qty</Text>
      <Text style={S.col3}>Unit</Text>
      {labour && <Text style={S.col4}>Hrs/unit</Text>}
      {labour && <Text style={S.col5}>Total hrs</Text>}
    </View>
  )
}

export function EstimateReport(props: EstimateReportProps): React.JSX.Element {
  return (
    <Document title={`Estimate — ${props.projectNumber}`}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.headerTitle}>
            <Text style={S.green}>NMDC Energy</Text> — Scaffolding Estimate
          </Text>
          <Text style={S.headerSub}>
            {props.projectNumber} · {props.title} · {props.client}
          </Text>
          <Text style={S.headerSub}>Date: {props.date}</Text>
        </View>

        {/* Per structure */}
        {props.structures.map((struct) => (
          <View key={struct.structureId}>
            <Text style={S.sectionTitle}>
              {struct.structureName}{' '}
              <Text style={{ fontFamily: 'Helvetica', fontSize: 9, color: '#666' }}>
                ({struct.structureId}) — {struct.structureManhours.toFixed(1)} hrs total
              </Text>
            </Text>

            {struct.zones.map((zone) => (
              <View key={zone.label}>
                <Text style={S.zoneTitle}>
                  {zone.label} ({zone.scaffoldType}) — {zone.zoneManhours.toFixed(1)} hrs
                </Text>

                {zone.labourItems.length > 0 && (
                  <View>
                    <Text style={S.categoryLabel}>LABOUR</Text>
                    <TableHeader labour />
                    {zone.labourItems.map((item, idx) => (
                      <View key={idx} style={S.tableRow}>
                        <Text style={S.col1}>{item.description}</Text>
                        <Text style={S.col2}>{item.quantity.toFixed(2)}</Text>
                        <Text style={S.col3}>{item.unit}</Text>
                        <Text style={S.col4}>{item.unitManhours.toFixed(2)}</Text>
                        <Text style={S.col5}>{(item.quantity * item.unitManhours).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {zone.materialItems.length > 0 && (
                  <View>
                    <Text style={S.categoryLabel}>MATERIALS</Text>
                    <TableHeader labour={false} />
                    {zone.materialItems.map((item, idx) => (
                      <View key={idx} style={S.tableRow}>
                        <Text style={S.col1}>{item.description}</Text>
                        <Text style={S.col2}>{item.quantity.toFixed(2)}</Text>
                        <Text style={S.col3}>{item.unit}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}

        {/* Summary */}
        <View style={S.summary}>
          <Text style={[S.sectionTitle, { marginTop: 0, marginBottom: 8 }]}>Summary</Text>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Total Manhours</Text>
            <Text style={S.summaryValue}>{props.totalManhours.toFixed(1)} hrs</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Duration</Text>
            <Text style={S.summaryValue}>{props.durationWeeks} week{props.durationWeeks !== 1 ? 's' : ''}</Text>
          </View>
          <View style={S.summaryRow}>
            <Text style={S.summaryLabel}>Peak Weekly Demand</Text>
            <Text style={S.summaryValue}>{props.peakWeeklyDemand.toFixed(1)} hrs/week</Text>
          </View>
          {props.materialsByType.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[S.categoryLabel, { marginBottom: 4 }]}>Materials by Type</Text>
              {props.materialsByType.map((m, idx) => (
                <View key={idx} style={S.summaryRow}>
                  <Text style={S.summaryLabel}>{m.description}</Text>
                  <Text style={S.summaryValue}>{m.quantity.toFixed(2)} {m.unit}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
