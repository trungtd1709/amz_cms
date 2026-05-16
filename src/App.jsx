import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
} from 'lucide-react'
import PropTypes from 'prop-types'
import './App.css'

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

const REPORTS = {
  sp: {
    label: 'SP Advertised',
    path: '/sp-advertised',
    endpoint: '/api/cms/reports/sp-advertised-products',
    totalCostEndpoint: '/api/cms/reports/sp-advertised-products/total-cost',
    skuDailyEndpoint: '/api/cms/reports/sp-advertised-products/sku-daily-cost',
    skuLabel: 'Advertised SKU',
    filterKey: 'sku',
    title: 'Sponsored Products advertised product report',
    subtitle: 'SKU-level ad cost, sales, clicks, and conversion performance.',
    hasCostFilter: true,
  },
  sb: {
    label: 'SB Campaigns',
    path: '/sb-campaigns',
    endpoint: '/api/cms/reports/sb-campaigns',
    skuDailyEndpoint: '/api/cms/reports/sb-campaigns/sku-daily-cost',
    skuLabel: 'Campaign Name',
    filterKey: 'campaignName',
    title: 'Sponsored Brands campaigns report',
    subtitle: 'Campaign-level cost, sales, clicks, and new-to-brand metrics per day.',
    hasCostFilter: true,
  },
  sd: {
    label: 'SD Advertised',
    path: '/sd-advertised',
    endpoint: '/api/cms/reports/sd-advertised-products',
    skuLabel: 'Promoted SKU / ASIN',
    filterKey: 'sku',
    title: 'Sponsored Display advertised product report',
    subtitle: 'SKU-level ad cost, sales, clicks, and display performance.',
    hasCostFilter: true,
  },
}

const DEFAULT_REPORT = 'sp'
const PAGE_SIZES = [10, 20, 50, 100]
const REPORT_VIEWS = {
  sp: {
    table: {
      label: 'Table',
      title: 'Sponsored Products advertised product report',
      subtitle: 'SKU-level ad cost, sales, clicks, and conversion performance.',
    },
    skuDaily: {
      label: 'SKU daily cost',
      title: 'SP cost by SKU per day',
      subtitle: 'Total ad cost grouped by advertised SKU and date across all campaigns.',
    },
  },
  sb: {
    table: {
      label: 'Campaigns',
      title: 'Sponsored Brands campaigns report',
      subtitle: 'Campaign-level cost, sales, clicks, and new-to-brand metrics per day.',
    },
    skuDaily: {
      label: 'SKU daily cost',
      title: 'SB cost by SKU per day',
      subtitle: 'Allocated Sponsored Brands cost grouped by participating SKU and date.',
    },
  },
}

const spColumns = [
  { key: 'date', label: 'Date' },
  { key: 'advertisedSku', label: 'SKU' },
  { key: 'advertisedAsin', label: 'ASIN' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'cost', label: 'Cost', type: 'money' },
  { key: 'spend', label: 'Spend', type: 'money' },
  { key: 'sales7d', label: 'Sales 7d', type: 'money' },
  { key: 'clicks', label: 'Clicks', type: 'number' },
  { key: 'impressions', label: 'Impressions', type: 'number' },
  { key: 'purchases7d', label: 'Purchases 7d', type: 'number' },
  { key: 'acosClicks7d', label: 'ACOS 7d', type: 'percent' },
  { key: 'roasClicks7d', label: 'ROAS 7d', type: 'decimal' },
]

const skuDailyCostColumns = [
  { key: 'date', label: 'Date' },
  { key: 'sku', label: 'SKU' },
  { key: 'totalCost', label: 'Total Cost', type: 'money' },
  { key: 'totalClicks', label: 'Clicks', type: 'number' },
  { key: 'totalImpressions', label: 'Impressions', type: 'number' },
  { key: 'campaignCount', label: 'Campaigns', type: 'number' },
]

const sbColumns = [
  { key: 'date', label: 'Date' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'campaignStatus', label: 'Status' },
  { key: 'cost', label: 'Cost', type: 'money' },
  { key: 'sales', label: 'Sales', type: 'money' },
  { key: 'clicks', label: 'Clicks', type: 'number' },
  { key: 'impressions', label: 'Impressions', type: 'number' },
  { key: 'purchases', label: 'Purchases', type: 'number' },
  { key: 'unitsSold', label: 'Units Sold', type: 'number' },
  { key: 'participatingSkus', label: 'Participating SKUs', type: 'tags' },
  { key: 'participatingAsins', label: 'Participating ASINs', type: 'tags' },
  { key: 'newToBrandSales', label: 'NTB Sales', type: 'money' },
  { key: 'newToBrandPurchases', label: 'NTB Purchases', type: 'number' },
]

const sdColumns = [
  { key: 'date', label: 'Date' },
  { key: 'promotedSku', label: 'SKU' },
  { key: 'promotedAsin', label: 'ASIN' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'cost', label: 'Cost', type: 'money' },
  { key: 'clicks', label: 'Clicks', type: 'number' },
  { key: 'impressions', label: 'Impressions', type: 'number' },
  { key: 'purchases', label: 'Purchases', type: 'number' },
  { key: 'sales', label: 'Sales', type: 'money' },
  { key: 'salesClicks', label: 'Sales (Clicks)', type: 'money' },
  { key: 'newToBrandPurchases', label: 'NTB Purchases', type: 'number' },
  { key: 'newToBrandSales', label: 'NTB Sales', type: 'money' },
]

function App() {
  const [activeReport, setActiveReport] = useState(getReportKeyFromPath())
  const [reportViews, setReportViews] = useState({
    sp: 'table',
    sb: 'table',
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sku: '',
    costOperator: 'gt',
    cost: '0',
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [pageData, setPageData] = useState(null)
  const [reportTotalCost, setReportTotalCost] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const report = REPORTS[activeReport]
  const activeView = reportViews[activeReport] || 'table'
  const reportViewOptions = REPORT_VIEWS[activeReport]
  const activeViewConfig = reportViewOptions?.[activeView]
  const isSkuDailyView = activeView === 'skuDaily' && Boolean(report.skuDailyEndpoint)
  const filterLabel = isSkuDailyView ? 'SKU' : report.skuLabel
  const filterKey = isSkuDailyView ? 'sku' : report.filterKey
  const showCostFilter = report.hasCostFilter && !isSkuDailyView
  const columns = isSkuDailyView ? skuDailyCostColumns : activeReport === 'sp' ? spColumns : activeReport === 'sd' ? sdColumns : sbColumns
  const rows = useMemo(() => pageData?.content || [], [pageData])

  useEffect(() => {
    function syncRoute() {
      const nextReport = getReportKeyFromPath()
      setActiveReport((currentReport) => {
        if (currentReport === nextReport) return currentReport
        setPage(0)
        return nextReport
      })
    }

    normalizeRoute()
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    if (activeReport !== 'sb' || !isSkuDailyView) return

    setFilters((current) =>
      current.startDate && current.endDate ? current : buildFiltersWithDefaultDateRange(current),
    )
    setAppliedFilters((current) =>
      current.startDate && current.endDate ? current : buildFiltersWithDefaultDateRange(current),
    )
  }, [activeReport, isSkuDailyView])

  const totals = useMemo(() => {
    const source = rows
    return source.reduce(
      (acc, item) => ({
        cost: acc.cost + Number(item.totalCost ?? item.cost ?? 0),
        sales: acc.sales + Number(item.sales7d || item.sales14d || item.sales || 0),
        clicks: acc.clicks + Number(item.totalClicks ?? item.clicks ?? 0),
        units: acc.units + Number(item.unitsSold14d || 0),
      }),
      { cost: 0, sales: 0, clicks: 0, units: 0 },
    )
  }, [rows])

  const displayedCostTotal = reportTotalCost ?? totals.cost

  useEffect(() => {
    const controller = new AbortController()

    async function loadReport() {
      setLoading(true)
      setError('')

      const requestFilters =
        activeReport === 'sb' && isSkuDailyView
          ? buildFiltersWithDefaultDateRange(appliedFilters)
          : appliedFilters
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('size', String(pageSize))
      if (!isSkuDailyView) {
        params.append('sort', 'date,desc')
        params.append('sort', 'id,desc')
      }

      Object.entries(requestFilters).forEach(([key, value]) => {
        if (!value && value !== 0) return
        if (!showCostFilter && (key === 'cost' || key === 'costOperator')) return
        const paramKey = key === 'sku' ? filterKey : key
        params.set(paramKey, value)
      })

      try {
        const endpoint = isSkuDailyView ? report.skuDailyEndpoint : report.endpoint
        const reportRequest = fetch(`${API_BASE_URL}${endpoint}?${params}`, { signal: controller.signal })
        const totalCostParams = new URLSearchParams(params)
        totalCostParams.delete('page')
        totalCostParams.delete('size')
        totalCostParams.delete('sort')
        const totalCostRequest =
          activeReport === 'sp' && !isSkuDailyView
            ? fetch(`${API_BASE_URL}${report.totalCostEndpoint}?${totalCostParams}`, { signal: controller.signal })
            : null

        const [response, totalCostResponse] = await Promise.all(
          totalCostRequest ? [reportRequest, totalCostRequest] : [reportRequest, Promise.resolve(null)],
        )

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }
        if (totalCostResponse && !totalCostResponse.ok) {
          throw new Error(`Total cost request failed with status ${totalCostResponse.status}`)
        }

        const body = await response.json()
        if (isSkuDailyView) {
          setPageData(body.data?.page)
          setReportTotalCost(Number(body.data?.totalCost || 0))
        } else {
          setPageData(body.data)
          if (totalCostResponse) {
            const totalCostBody = await totalCostResponse.json()
            setReportTotalCost(Number(totalCostBody.data || 0))
          } else {
            setReportTotalCost(null)
          }
        }
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || 'Unable to load report data')
        }
      } finally {
        setLoading(false)
      }
    }

    loadReport()
    return () => controller.abort()
  }, [
    activeReport,
    appliedFilters,
    filterKey,
    isSkuDailyView,
    page,
    pageSize,
    report.endpoint,
    report.skuDailyEndpoint,
    report.totalCostEndpoint,
    showCostFilter,
  ])

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function applyFilters(event) {
    event.preventDefault()
    setPage(0)
    setAppliedFilters(filters)
  }

  function resetFilters() {
    const nextFilters =
      activeReport === 'sb' && isSkuDailyView
        ? buildFiltersWithDefaultDateRange()
        : buildEmptyFilters()
    setFilters(nextFilters)
    setAppliedFilters(nextFilters)
    setPage(0)
  }

  function changeReport(event, nextReport) {
    event.preventDefault()
    const nextPath = REPORTS[nextReport].path

    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }

    setActiveReport(nextReport)
    setPage(0)
  }

  function changeReportView(nextView) {
    setReportViews((current) => ({
      ...current,
      [activeReport]: nextView,
    }))
    if (activeReport === 'sb' && nextView === 'skuDaily') {
      setFilters((current) => buildFiltersWithDefaultDateRange(current))
      setAppliedFilters((current) => buildFiltersWithDefaultDateRange(current))
    }
    setPage(0)
  }

  const totalPages = pageData?.totalPages || 0
  const totalElements = pageData?.totalElements || 0
  const visibleStart = totalElements === 0 ? 0 : page * pageSize + 1
  const visibleEnd = Math.min((page + 1) * pageSize, totalElements)

  return (
    <main className={sidebarOpen ? 'app-layout' : 'app-layout sidebar-collapsed'}>
      <aside className={sidebarOpen ? 'sidebar' : 'sidebar collapsed'}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <p className="eyebrow">Amazon Ads CMS</p>
            <strong>Reports</strong>
          </div>
          <button
            className="icon-button sidebar-toggle"
            onClick={() => setSidebarOpen((current) => !current)}
            type="button"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Report type">
          {Object.entries(REPORTS).map(([key, item]) => (
            <a
              className={activeReport === key ? 'sidebar-link active' : 'sidebar-link'}
              href={item.path}
              key={key}
              onClick={(event) => changeReport(event, key)}
              aria-current={activeReport === key ? 'page' : undefined}
            >
              <Table2 size={16} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="api-pill sidebar-api">
          <span>API</span>
          <strong>{API_BASE_URL.replace(/^https?:\/\//, '')}</strong>
        </div>
      </aside>

      <section className="app-shell">
        <section className="page-header">
          <div>
            <h1>Report control center</h1>
            <p className="header-copy">
              Filter report dates, SKU or ASIN, and ad cost thresholds with paginated views built for daily checks.
            </p>
          </div>
        </section>

        {reportViewOptions && (
          <section className="view-toolbar" aria-label={`${report.label} report view`}>
            <div className="tabs view-tabs">
              {Object.entries(reportViewOptions).map(([key, item]) => (
                <button
                  className={activeView === key ? 'tab active' : 'tab'}
                  key={key}
                  onClick={() => changeReportView(key)}
                  type="button"
                >
                  <Table2 size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        )}

      <form className="filters" onSubmit={applyFilters}>
        <div className="filter-title">
          <SlidersHorizontal size={18} />
          <span>Filters</span>
        </div>
        <label>
          Start date
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => updateFilter('startDate', event.target.value)}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => updateFilter('endDate', event.target.value)}
          />
        </label>
        <label className="sku-filter">
          {filterLabel}
          <input
            placeholder={`Search ${filterLabel.toLowerCase()}`}
            value={filters.sku}
            onChange={(event) => updateFilter('sku', event.target.value)}
          />
        </label>
        {showCostFilter && (
          <>
            <label>
              Cost filter
              <select
                value={filters.costOperator}
                onChange={(event) => updateFilter('costOperator', event.target.value)}
              >
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
              </select>
            </label>
            <label>
              Cost
              <input
                min="0"
                step="0.01"
                type="number"
                value={filters.cost}
                onChange={(event) => updateFilter('cost', event.target.value)}
              />
            </label>
          </>
        )}
        <div className="filter-actions">
          <button className="ghost-button" onClick={resetFilters} type="button">
            <RefreshCw size={16} />
            Reset
          </button>
          <button className="primary-button" type="submit">
            <Search size={16} />
            Search
          </button>
        </div>
      </form>

      <section className="summary-grid">
        <Metric label="Rows found" value={formatNumber(totalElements)} />
        <Metric
          label={isSkuDailyView || activeReport === 'sp' ? 'Total cost' : report.hasCostFilter ? 'Page cost' : 'Page sales'}
          value={formatMoney(isSkuDailyView || activeReport === 'sp' ? displayedCostTotal : report.hasCostFilter ? totals.cost : totals.sales)}
        />
        <Metric
          label={isSkuDailyView ? 'Page clicks' : report.hasCostFilter ? 'Page clicks' : 'Page units'}
          value={formatNumber(isSkuDailyView ? totals.clicks : report.hasCostFilter ? totals.clicks : totals.units)}
        />
      </section>

      <section className="report-panel">
        <div className="report-head">
          <div>
            <h2>{activeViewConfig?.title || report.title}</h2>
            <p>{activeViewConfig?.subtitle || report.subtitle}</p>
          </div>
          <label className="page-size">
            Rows
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(0)
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="alert">{error}</div>}

        {(activeReport === 'sp' || isSkuDailyView) && (
          <div className="total-line">
            <span>Total cost</span>
            <strong>{formatMoney(displayedCostTotal)}</strong>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="table-state" colSpan={columns.length}>
                    Loading report data...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="table-state" colSpan={columns.length}>
                    No rows match the current filters.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id ?? `${row.sku}-${row.date}`}>
                    {columns.map((column) => (
                      <td key={column.key} title={column.type === 'tags' ? '' : String(row[column.key] ?? '')}>
                        {column.type === 'tags'
                          ? renderTags(row[column.key])
                          : formatCell(row[column.key], column.type)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>
            Showing {formatNumber(visibleStart)}-{formatNumber(visibleEnd)} of {formatNumber(totalElements)}
          </span>
          <div className="pagination-controls">
            <button
              className="icon-button"
              disabled={page === 0 || loading}
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
              type="button"
              title="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
            <strong>
              Page {totalPages === 0 ? 0 : page + 1} / {totalPages}
            </strong>
            <button
              className="icon-button"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              type="button"
              title="Next page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      </section>
    </main>
  )
}

function Metric(props) {
  const { label, value } = props

  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

Metric.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
}

function buildEmptyFilters() {
  return {
    startDate: '',
    endDate: '',
    sku: '',
    costOperator: 'gt',
    cost: '0',
  }
}

function buildFiltersWithDefaultDateRange(current = {}) {
  const range = getDefaultDateRange()
  return {
    ...buildEmptyFilters(),
    ...current,
    startDate: current.startDate || range.startDate,
    endDate: current.endDate || range.endDate,
  }
}

function getDefaultDateRange() {
  const endDate = new Date()
  endDate.setHours(0, 0, 0, 0)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 6)

  return {
    startDate: formatDateInput(startDate),
    endDate: formatDateInput(endDate),
  }
}

function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeApiBaseUrl(value) {
  if (!value) return 'http://localhost:8080'
  return value.replace('localhost:8081', 'localhost:8080')
}

function renderTags(tags) {
  if (!tags || tags.length === 0) return '-'
  return (
    <div className="product-tags">
      {tags.map((tag) => (
        <span className="product-tag sku-tag" key={tag} title={tag}>
          {tag}
        </span>
      ))}
    </div>
  )
}

function formatCell(value, type) {
  if (value === null || value === undefined || value === '') return '-'
  if (type === 'money') return formatMoney(value)
  if (type === 'number') return formatNumber(value)
  if (type === 'decimal') return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (type === 'percent') return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
  return String(value)
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  })
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function getReportKeyFromPath() {
  const pathname = window.location.pathname
  const reportEntry = Object.entries(REPORTS).find(([, report]) => report.path === pathname)
  return reportEntry?.[0] || DEFAULT_REPORT
}

function normalizeRoute() {
  const pathname = window.location.pathname
  const isKnownRoute = Object.values(REPORTS).some((report) => report.path === pathname)

  if (pathname === '/' || !isKnownRoute) {
    window.history.replaceState({}, '', REPORTS[DEFAULT_REPORT].path)
  }
}

export default App
