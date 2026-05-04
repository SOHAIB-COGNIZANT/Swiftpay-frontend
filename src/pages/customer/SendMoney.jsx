import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { fxQuotesAPI } from '../../api/fxquotes'
import { rateLocksAPI } from '../../api/ratelocks'
import { beneficiariesAPI } from '../../api/beneficiaries'
import { remittancesAPI } from '../../api/remittances'
import Layout from '../../components/layout/Layout'
import Card from '../../components/common/Card'
import Loader from '../../components/common/Loader'
import toast from 'react-hot-toast'
import { ArrowRight, Lock, RefreshCw, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'INR', 'MYR', 'HKD', 'CHF']
const PURPOSE_CODES = ['Family Remittance', 'Education', 'Medical', 'Business Payment', 'Gift', 'Investment', 'Travel', 'Other']
const SOURCE_OF_FUNDS = ['Salary', 'Business Income', 'Savings', 'Investment Returns', 'Gift', 'Loan', 'Other']

const STEPS = ['Get Quote', 'Select Recipient', 'Review & Send']

export default function SendMoney() {
  const { user, customerProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [fromCurrency, setFromCurrency] = useState('USD')
  const [toCurrency, setToCurrency] = useState('INR')
  const [sendAmount, setSendAmount] = useState('')
  const [quote, setQuote] = useState(null)
  const [rateLock, setRateLock] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [lockLoading, setLockLoading] = useState(false)
  const [beneficiaries, setBeneficiaries] = useState([])
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null)
  const [purposeCode, setPurposeCode] = useState('')
  const [sourceOfFunds, setSourceOfFunds] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (customerProfile?.customerId) {
      beneficiariesAPI.getByCustomer(customerProfile.customerId)
        .then((r) => setBeneficiaries(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
    }
  }, [customerProfile])

  const handleGetQuote = async (e) => {
    e.preventDefault()
    if (!sendAmount || parseFloat(sendAmount) <= 0) { toast.error('Enter a valid amount'); return }
    if (fromCurrency === toCurrency) { toast.error('From and To currencies must be different'); return }
    setQuoteLoading(true)
    try {
      const res = await fxQuotesAPI.create({
        fromCurrency,
        toCurrency,
        sendAmount: parseFloat(sendAmount),
      })
      setQuote(res.data)
      setStep(0.5)
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || 'Failed to get quote'
      toast.error(typeof msg === 'string' ? msg : 'Currency corridor not supported')
    } finally {
      setQuoteLoading(false)
    }
  }

  const handleLockRate = async () => {
    if (!quote || !customerProfile) return
    setLockLoading(true)
    try {
      const res = await rateLocksAPI.create({
        quoteId: quote.quoteId,      // camelCase — matches backend response
        customerId: customerProfile.customerId,
      })
      setRateLock(res.data)
      toast.success('Rate locked successfully!')
      setStep(1)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to lock rate')
    } finally {
      setLockLoading(false)
    }
  }

  const handleSubmitRemittance = async () => {
    if (!selectedBeneficiary) { toast.error('Select a recipient'); return }
    if (!purposeCode) { toast.error('Select purpose of remittance'); return }
    if (!sourceOfFunds) { toast.error('Select source of funds'); return }
    setSubmitting(true)
    try {
      const res = await remittancesAPI.create({
        customerId: customerProfile.customerId,
        beneficiaryId: selectedBeneficiary.beneficiaryId,
        fromCurrency,
        toCurrency,
        sendAmount: parseFloat(sendAmount),
        receiverAmount: quote?.receiverAmount,
        quoteId: quote?.quoteId,
        feeApplied: quote?.fee ?? 0,
        rateApplied: quote?.offeredRate ?? 1,
        purposeCode,
        sourceOfFunds,
      })
      toast.success('Remittance submitted successfully!')
      navigate(`/customer/remittances/${res.data.remitId}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create remittance')
    } finally {
      setSubmitting(false)
    }
  }

  const lockTimeLeft = rateLock ? Math.max(0, Math.round((new Date(rateLock.lockExpiry) - Date.now()) / 60000)) : 0

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Send Money</h1>
          <p className="text-gray-500 text-sm mt-1">International transfer in a few simple steps</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 text-sm font-medium ${i <= step ? 'text-primary-600' : 'text-gray-400'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${i < step ? 'bg-primary-600 text-white' : i === Math.floor(step) ? 'bg-primary-100 text-primary-700 border-2 border-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                  {i < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-primary-600' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: Quote calculator */}
        {step < 1 && (
          <Card title="Get Live Quote">
            <form onSubmit={handleGetQuote} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">You Send</label>
                  <div className="flex gap-2">
                    <input
                      type="number" min="1" required
                      value={sendAmount} onChange={(e) => setSendAmount(e.target.value)}
                      className="form-input flex-1" placeholder="1000" />
                    <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} className="form-select w-24">
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">Recipient Gets</label>
                  <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="form-select">
                    {CURRENCIES.filter((c) => c !== fromCurrency).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={quoteLoading} className="btn-primary w-full flex items-center justify-center gap-2">
                {quoteLoading ? <><Loader size="sm" /> Fetching quote...</> : <><RefreshCw size={16} /> Get Quote</>}
              </button>
            </form>

            {/* Quote result */}
            {quote && (
              <div className="mt-5 bg-primary-50 rounded-xl p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Exchange Rate</span>
                  <span className="font-semibold text-primary-700">
                    1 {fromCurrency} = {quote.offeredRate?.toFixed(4)} {toCurrency}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Fee</span>
                  <span className="font-medium">{fromCurrency} {quote.fee != null ? quote.fee.toFixed(2) : '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Margin (bps)</span>
                  <span className="font-medium">{quote.marginBps ?? '—'}</span>
                </div>
                <div className="border-t border-primary-200 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-700">Recipient Gets</span>
                  <span className="text-xl font-bold text-green-600">
                    {toCurrency} {quote.receiverAmount != null ? quote.receiverAmount.toFixed(2) : '—'}
                  </span>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setQuote(null); setSendAmount('') }} className="btn-secondary flex-1">
                    Change
                  </button>
                  <button onClick={handleLockRate} disabled={lockLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {lockLoading ? <><Loader size="sm" /> Locking...</> : <><Lock size={15} /> Lock Rate</>}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Rate valid until {quote.validUntil ? new Date(quote.validUntil).toLocaleTimeString() : '—'}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Step 1: Select beneficiary */}
        {step >= 1 && step < 2 && (
          <Card title="Select Recipient">
            {rateLock && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-green-700">
                <Lock size={14} /> Rate locked for {lockTimeLeft} more minutes
              </div>
            )}
            {beneficiaries.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle size={36} className="text-gray-200 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No beneficiaries added yet.</p>
                <a href="/customer/beneficiaries" className="btn-primary text-sm mt-3 inline-block">Add Beneficiary</a>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {beneficiaries.map((b) => (
                  <div
                    key={b.beneficiaryId}
                    onClick={() => setSelectedBeneficiary(b)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedBeneficiary?.beneficiaryId === b.beneficiaryId
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-100 hover:border-primary-200'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{b.name}</p>
                        <p className="text-xs text-gray-500">{b.bankName} • {b.country} • {b.payoutMode}</p>
                        <p className="text-xs text-gray-400 font-mono mt-1">{b.accountOrWalletNo}</p>
                      </div>
                      {selectedBeneficiary?.beneficiaryId === b.beneficiaryId && (
                        <CheckCircle size={20} className="text-primary-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Purpose of Remittance</label>
                <select value={purposeCode} onChange={(e) => setPurposeCode(e.target.value)} className="form-select">
                  <option value="">Select purpose</option>
                  {PURPOSE_CODES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Source of Funds</label>
                <select value={sourceOfFunds} onChange={(e) => setSourceOfFunds(e.target.value)} className="form-select">
                  <option value="">Select source</option>
                  {SOURCE_OF_FUNDS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
              <button
                onClick={() => { if (selectedBeneficiary && purposeCode && sourceOfFunds) setStep(2); else toast.error('Fill all required fields') }}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </Card>
        )}

        {/* Step 2: Review & Submit */}
        {step >= 2 && (
          <Card title="Review & Confirm">
            <div className="space-y-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">You Send</span>
                  <span className="font-semibold">{fromCurrency} {sendAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Exchange Rate</span>
                  <span className="font-semibold">{quote?.offeredRate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fee</span>
                  <span className="font-semibold">{fromCurrency} {quote?.fee != null ? quote.fee.toFixed(2) : '0.00'}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-700">Recipient Gets</span>
                  <span className="font-bold text-green-600 text-base">{toCurrency} {quote?.receiverAmount?.toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="font-semibold text-gray-700">Recipient Details</p>
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">{selectedBeneficiary?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-medium">{selectedBeneficiary?.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account</span>
                  <span className="font-mono text-xs">{selectedBeneficiary?.accountOrWalletNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Country</span>
                  <span className="font-medium">{selectedBeneficiary?.country}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Purpose</span>
                  <span className="font-medium">{purposeCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Source of Funds</span>
                  <span className="font-medium">{sourceOfFunds}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleSubmitRemittance} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {submitting ? <><Loader size="sm" /> Submitting...</> : 'Confirm & Send'}
              </button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  )
}
