import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { customersAPI } from '../../api/customers'
import { kycAPI } from '../../api/kyc'
import { usersAPI } from '../../api/users'
import Layout from '../../components/layout/Layout'
import Card from '../../components/common/Card'
import StatusBadge from '../../components/common/StatusBadge'
import Loader from '../../components/common/Loader'
import toast from 'react-hot-toast'
import { User, Shield, Edit2, CheckCircle, AlertTriangle, Upload } from 'lucide-react'

const NATIONALITIES = ['Indian', 'American', 'British', 'Emirati', 'Singaporean', 'Australian', 'Canadian', 'Malaysian', 'Filipino', 'Bangladeshi']
const RISK_LEVELS = ['Low', 'Medium', 'High']

export default function Profile() {
  const { user, customerProfile } = useAuth()
  const [profile, setProfile] = useState(null)
  const [kyc, setKyc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editProfile, setEditProfile] = useState(false)
  const [editKyc, setEditKyc] = useState(false)
  const [profileForm, setProfileForm] = useState({})
  const [kycForm, setKycForm] = useState({ kycLevel: 'Min', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user?.userId) { setLoading(false); return }
    Promise.all([
      customersAPI.getByUserId(user.userId).catch(() => ({ data: null })),
      kycAPI.getByUser(user.userId).catch(() => ({ data: null })),
    ]).then(([p, k]) => {
      setProfile(p.data)
      setProfileForm({ dob: p.data?.dob?.substring(0, 10) || '', nationality: p.data?.nationality || '', addressJSON: p.data?.addressJSON || '' })
      setKyc(k.data)
    }).finally(() => setLoading(false))
  }, [user])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (profile) {
        await customersAPI.update(profile.customerId, { ...profile, ...profileForm })
        toast.success('Profile updated')
      } else {
        await customersAPI.create({ userId: user.userId, ...profileForm })
        toast.success('Profile created')
      }
      setEditProfile(false)
      const p = await customersAPI.getByUserId(user.userId)
      setProfile(p.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitKyc = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (kyc) {
        await kycAPI.update(kyc.kycId, { ...kyc, ...kycForm })
        toast.success('KYC record updated')
      } else {
        await kycAPI.create({ userId: user.userId, ...kycForm })
        toast.success('KYC record submitted')
      }
      setEditKyc(false)
      const k = await kycAPI.getByUser(user.userId)
      setKyc(k.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit KYC')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Layout><Loader center /></Layout>

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile & KYC</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your personal details and verification</p>
        </div>

        {/* Account summary */}
        <div className="gradient-hero rounded-2xl p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold text-white">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <p className="text-xl font-bold text-white">{user?.name}</p>
            <p className="text-blue-200 text-sm">{user?.email}</p>
            <p className="text-blue-200 text-sm">{user?.phone}</p>
          </div>
          <div className="text-right">
            <StatusBadge status={kyc?.verificationStatus || 'Pending'} />
            <p className="text-blue-200 text-xs mt-1">KYC Status</p>
          </div>
        </div>

        {/* Customer Profile */}
        <Card title="Customer Profile"
          action={
            !editProfile && (
              <button onClick={() => setEditProfile(true)} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1">
                <Edit2 size={13} /> Edit
              </button>
            )
          }>
          {editProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Date of Birth</label>
                  <input type="date" value={profileForm.dob}
                    onChange={(e) => setProfileForm((f) => ({ ...f, dob: e.target.value }))}
                    className="form-input" />
                </div>
                <div>
                  <label className="form-label">Nationality</label>
                  <select value={profileForm.nationality}
                    onChange={(e) => setProfileForm((f) => ({ ...f, nationality: e.target.value }))}
                    className="form-select">
                    <option value="">Select nationality</option>
                    {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="form-label">Address (JSON or Text)</label>
                  <textarea value={profileForm.addressJSON}
                    onChange={(e) => setProfileForm((f) => ({ ...f, addressJSON: e.target.value }))}
                    className="form-input" rows={3}
                    placeholder='{"street":"123 Main St","city":"Mumbai","state":"MH","zip":"400001"}' />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditProfile(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : (
            profile ? (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Date of Birth', profile.dob ? new Date(profile.dob).toLocaleDateString() : '—'],
                  ['Nationality', profile.nationality || '—'],
                  ['Risk Rating', profile.riskRating || '—'],
                  ['Status', profile.status || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-0.5">{k}</dt>
                    <dd className="font-medium text-gray-900">{v}</dd>
                  </div>
                ))}
                <div className="col-span-2">
                  <dt className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-0.5">Address</dt>
                  <dd className="font-mono text-xs text-gray-700 bg-gray-50 rounded-lg p-2">{profile.addressJSON || '—'}</dd>
                </div>
              </dl>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle size={32} className="text-amber-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm mb-3">Profile not created yet</p>
                <button onClick={() => setEditProfile(true)} className="btn-primary text-sm">Create Profile</button>
              </div>
            )
          )}
        </Card>

        {/* KYC */}
        <Card title="KYC Verification"
          action={
            !editKyc && (
              <button onClick={() => setEditKyc(true)} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1">
                <Shield size={13} /> {kyc ? 'Update KYC' : 'Submit KYC'}
              </button>
            )
          }>
          {kyc && !editKyc ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                  ${kyc.verificationStatus === 'Verified' ? 'bg-green-100' : kyc.verificationStatus === 'Rejected' ? 'bg-red-100' : 'bg-amber-100'}`}>
                  {kyc.verificationStatus === 'Verified'
                    ? <CheckCircle size={24} className="text-green-600" />
                    : <AlertTriangle size={24} className={kyc.verificationStatus === 'Rejected' ? 'text-red-600' : 'text-amber-600'} />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">KYC Level: {kyc.kycLevel}</p>
                  <p className="text-sm text-gray-500">{kyc.verificationStatus} {kyc.verifiedDate ? `• Verified ${new Date(kyc.verifiedDate).toLocaleDateString()}` : ''}</p>
                </div>
                <StatusBadge status={kyc.verificationStatus} />
              </div>
              {kyc.notes && (
                <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                  <strong>Notes: </strong>{kyc.notes}
                </div>
              )}
            </div>
          ) : editKyc ? (
            <form onSubmit={handleSubmitKyc} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">KYC Level</label>
                  <select value={kycForm.kycLevel}
                    onChange={(e) => setKycForm((f) => ({ ...f, kycLevel: e.target.value }))}
                    className="form-select">
                    {['Min', 'Full', 'Enhanced'].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="form-label">Notes / Supporting Information</label>
                  <textarea value={kycForm.notes}
                    onChange={(e) => setKycForm((f) => ({ ...f, notes: e.target.value }))}
                    className="form-input" rows={3} placeholder="Add notes or reference document IDs" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditKyc(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Upload size={14} /> {saving ? 'Submitting...' : 'Submit KYC'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <Shield size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-gray-500 text-sm mb-3">KYC not submitted. Complete verification to unlock full features.</p>
              <button onClick={() => setEditKyc(true)} className="btn-primary text-sm">Submit KYC</button>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
