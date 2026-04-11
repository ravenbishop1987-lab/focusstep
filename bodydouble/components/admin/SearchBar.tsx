'use client'

type Props = {
  query: string
  setQuery: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  memberFilter: string
  setMemberFilter: (v: string) => void
}

export default function SearchBar({ query, setQuery, statusFilter, setStatusFilter, memberFilter, setMemberFilter }: Props) {
  return (
    <div className="a-searchbar">
      <div className="a-search-input-wrap">
        <span className="a-search-icon">🔍</span>
        <input
          className="a-search-input"
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && <button className="a-search-clear" onClick={() => setQuery('')}>✕</button>}
      </div>
      <div className="a-filters">
        <select className="a-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className="a-filter-select" value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="lifetime">Lifetime</option>
        </select>
      </div>
    </div>
  )
}
