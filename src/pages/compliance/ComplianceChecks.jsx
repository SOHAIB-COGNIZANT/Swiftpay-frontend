import React, { useEffect, useState } from 'react'
import { remittancesAPI } from '../../api/remittances'
import { complianceAPI } from '../../api/compliance'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/layout/Layout'
import Card from '../../components/common/Card'
import Table from '../../components/common/Table'
import Modal from '../../components/common/Modal'
import StatusBadge from '../../components/common/StatusBadge'
import Loader from '../../components/common/Loader'
import toast from 'react-hot-toast'
import { Shield, CheckCircle, AlertTriangle, Search } from 'lucide-react'

export default function ComplianceChecks() {
  const { user } = useAuth()
  const [remittances, setRemittances] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRemit, setSelectedRemit] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [decisionForm, setDecisionForm] = useState({ decision: 'Approve', notes: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    remittancesAPI.getAll()
      .then((r) => setRemittances(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const openDecision = async (remit) => {
    setSelectedRemit(remit)
    try {
      const r = await complianceAPI.getDecisionsByRemit(remit.remitId)
      setDecisions(Array.isArray(r.data) ? r.data : [])
    } catch { setDecisions([]) }
    setDecisionForm({ decision: 'Approve', notes: '' })
    setModalOpen(true)
  }

  const handleDecision = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await complianceAPI.createDecision({
        remitId: selectedRemit.remitId,
        analystId: user?.userId,
        decision: decisionForm.decision,
        notes: decisionForm.notes,
      })
      toast.success(`Decision recorded: ${decisionForm.decision}`)
      setModalOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const filtered = remittances.filter((r) => {
    return !search || `${r.remitId} ${r.status} ${r.fromCurrency} ${r.toCurrency}`.toLowerCase().includes(search.toLowerCase())
  })

  const columns = [
    { key: 'remitId',     label: 'ID',      render: (v) => <span className="font-mono">#{v}</span> },
    { key: 'createdDate', label: 'Date',    render: (v) => new Date(v).toLocaleDateString() },
    { key: 'fromCurrency',label: 'Corridor',render: (_, r) => `${r.fromCurrency}→${r.toCurrency}` },
    { key: 'sendAmount',  label: 'Amount',  render: (v, r) => `${r.fromCurrency} ${v?.toFixed(2)}` },
    { key: 'purposeCode', label: 'Purpose' },
    { key: 'status',      label: 'Status',  render: (v) => <StatusBadge status={v} /> },
    { key: 'remitId',     label: 'Action',
      render: (_, row) => (
        <button onClick={() => openDecision(row)} className="btn-secondary text-xs py-1 px-3">
          Review
        </button>
      )
    },
  ]

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Checks</h1>
          <p className="text-gray-500 text-sm">Review remittances for AML/PEP/Sanctions compliance</p>
        </div>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search remittances..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="form-input pl-9" />
            </div>
          </div>
          <Table columns={columns} data={filtered} loading={loading} emptyMessage="No remittances" />
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={`Compliance Decision – Remittance #${selectedRemit?.remitId}`} size="lg">
        {selectedRemit && (
          <div className="space-y-4">
            {/* Prior decisions */}
            {decisions.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Previous Decisions</p>
                <div className="space-y-2">
                  {decisions.map((d) => (
                    <div key={d.decisionId} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 text-sm">
                      {d.decision === 'Approve'
                        ? <CheckCircle size={14} className="text-green-500" />
                        : <AlertTriangle size={14} className="text-red-500" />}
                      <span className="font-medium">{d.decision}</span>
                      <span className="text-gray-500 flex-1">{d.notes}</span>
                      <span className="text-xs text-gray-400">{new Date(d.decisionDate).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleDecision} className="space-y-4">
              <div>
                <label className="form-label">Decision *</label>
                <div className="flex gap-3">
                  {['Approve', 'Hold', 'Reject'].map((v) => (
                    <button key={v} type="button"
                      onClick={() => setDecisionForm((f) => ({ ...f, decision: v }))}
                      className={`flex-1 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                        decisionForm.decision === v
                          ? v === 'Approve' ? 'border-green-500 bg-green-50 text-green-700'
                            : v === 'Hold' ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-500'
                      }`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Notes *</label>
                <textarea required value={decisionForm.notes}
                  onChange={(e) => setDecisionForm((f) => ({ ...f, notes: e.target.value }))}
                  className="form-input" rows={3} placeholder="Provide compliance notes..." />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Submitting...' : 'Record Decision'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
