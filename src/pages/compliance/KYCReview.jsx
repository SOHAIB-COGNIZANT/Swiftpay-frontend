import React, { useEffect, useState } from 'react'
import { kycAPI } from '../../api/kyc'
import Layout from '../../components/layout/Layout'
import Card from '../../components/common/Card'
import Table from '../../components/common/Table'
import Modal from '../../components/common/Modal'
import StatusBadge from '../../components/common/StatusBadge'
import Loader from '../../components/common/Loader'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Clock, Search } from 'lucide-react'

export default function KYCReview() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedKyc, setSelectedKyc] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [decision, setDecision] = useState({ verificationStatus: 'Verified', notes: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const load = () => {
    kycAPI.getAll()
      .then((r) => setRecords(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleReview = (kyc) => {
    setSelectedKyc(kyc)
    setDecision({ verificationStatus: 'Verified', notes: '' })
    setModalOpen(true)
  }

  const handleSubmitDecision = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await kycAPI.updateStatus(selectedKyc.kycId, { verificationStatus: decision.verificationStatus, notes: decision.notes })
      toast.success(`KYC ${decision.verificationStatus}`)
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const filtered = records.filter((r) => {
    const matchStatus = filter === 'All' || r.verificationStatus === filter
    const matchSearch = !search || `${r.kycId} ${r.kycLevel}`.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const columns = [
    { key: 'kycId',              label: 'KYC ID',   render: (v) => <span className="font-mono">#{v}</span> },
    { key: 'kycLevel',           label: 'Level',    render: (v) => <span className="text-sm font-medium">{v}</span> },
    { key: 'verificationStatus', label: 'Status',   render: (v) => <StatusBadge status={v} /> },
    { key: 'notes',              label: 'Notes',    render: (v) => <span className="text-xs text-gray-500 truncate max-w-32 block">{v || '—'}</span> },
    { key: 'kycId',              label: 'Action',
      render: (_, row) => (
        <button onClick={() => handleReview(row)} className="btn-secondary text-xs py-1 px-3">
          Review
        </button>
      )
    },
  ]

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC Review</h1>
          <p className="text-gray-500 text-sm">Review and verify customer KYC submissions</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {['All', 'Pending', 'Verified', 'Rejected'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
              }`}>
              {s}
            </button>
          ))}
        </div>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search KYC records..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="form-input pl-9" />
            </div>
          </div>
          <Table columns={columns} data={filtered} loading={loading} emptyMessage="No KYC records" />
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`KYC Review – #${selectedKyc?.kycId}`}>
        {selectedKyc && (
          <form onSubmit={handleSubmitDecision} className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">KYC Level</span>
                <span className="font-medium">{selectedKyc.kycLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Status</span>
                <StatusBadge status={selectedKyc.verificationStatus} />
              </div>
              {selectedKyc.notes && (
                <div>
                  <span className="text-gray-500">Notes: </span>
                  <span className="text-gray-700">{selectedKyc.notes}</span>
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Decision *</label>
              <div className="flex gap-3">
                {['Verified', 'Rejected'].map((v) => (
                  <button key={v} type="button"
                    onClick={() => setDecision((f) => ({ ...f, verificationStatus: v }))}
                    className={`flex-1 py-3 rounded-xl border-2 font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                      decision.verificationStatus === v
                        ? v === 'Verified' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {v === 'Verified' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Analyst Notes</label>
              <textarea value={decision.notes}
                onChange={(e) => setDecision((f) => ({ ...f, notes: e.target.value }))}
                className="form-input" rows={3} placeholder="Add review notes..." />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Submitting...' : 'Submit Decision'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  )
}
