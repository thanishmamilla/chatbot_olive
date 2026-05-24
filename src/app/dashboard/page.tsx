"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  Cpu, 
  RefreshCw, 
  BarChart2, 
  TrendingUp, 
  AlertCircle 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line 
} from 'recharts';

interface TelemetrySummary {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

interface DailyData {
  date: string;
  requests: number;
  avgLatency: number;
  errors: number;
}

interface ModelBreakdown {
  modelName: string;
  provider: string;
  requests: number;
  avgLatency: number;
  successRate: number;
  totalTokens: number;
}

interface MetricsData {
  summary: TelemetrySummary;
  dailyData: DailyData[];
  modelBreakdown: ModelBreakdown[];
}

export default function Dashboard() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('http://localhost:3001/logs/metrics');
      if (res.ok) {
        const metrics = await res.json();
        setData(metrics);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="typing-indicator-container" style={{ margin: 0 }}>
          <div className="typing-bubble">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading Dashboard Analytics...</span>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    totalRequests: 0,
    successRate: 100,
    avgLatency: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0
  };

  return (
    <div className="app-container" style={{ flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Navigation Header */}
      <header className="chat-header" style={{ width: '100%', borderBottom: '1px solid var(--glass-border)' }}>
        <div className="status-indicator">
          <span className="brand-logo" style={{ width: '20px', height: '20px', borderRadius: '4px' }}></span>
          <span className="status-text" style={{ fontWeight: 600 }}>AetherChat Analytics</span>
        </div>
        <div className="header-nav">
          <Link href="/" className="nav-link">Chat</Link>
          <Link href="/dashboard" className="nav-link active">Dashboard</Link>
        </div>
      </header>

      {/* Main Dashboard Space */}
      <div className="dashboard-workspace">
        <div className="dashboard-header-container">
          <div>
            <h1>System Performance</h1>
            <p>Real-time latency, throughput, and error metrics for foundation models.</p>
          </div>
          <button 
            onClick={fetchMetrics} 
            disabled={refreshing} 
            className="refresh-btn"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* KPI Cards Grid */}
        <div className="metrics-grid">
          {/* Card 1: Total Throughput */}
          <div className="kpi-card">
            <div className="kpi-icon-wrapper">
              <Activity size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-title">Total Requests</span>
              <span className="kpi-value">{summary.totalRequests}</span>
              <span className="kpi-subtitle">Last 7 Days</span>
            </div>
          </div>

          {/* Card 2: Avg Latency */}
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>
              <Clock size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-title">Avg Latency</span>
              <span className="kpi-value">{summary.avgLatency}ms</span>
              <span className="kpi-subtitle">End-to-End Latency</span>
            </div>
          </div>

          {/* Card 3: Success Rate */}
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <CheckCircle size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-title">Success Rate</span>
              <span className="kpi-value">{summary.successRate}%</span>
              <span className="kpi-subtitle">Inference Calls</span>
            </div>
          </div>

          {/* Card 4: Tokens Consumed */}
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
              <Cpu size={20} />
            </div>
            <div className="kpi-content">
              <span className="kpi-title">Total Tokens</span>
              <span className="kpi-value">{summary.totalTokens.toLocaleString()}</span>
              <span className="kpi-subtitle">{summary.inputTokens.toLocaleString()} in / {summary.outputTokens.toLocaleString()} out</span>
            </div>
          </div>
        </div>

        {/* Recharts Graphs Area */}
        <div className="charts-grid">
          {/* Chart 1: Throughput (Requests per Day) */}
          <div className="chart-card">
            <h2>
              <BarChart2 size={16} style={{ color: 'var(--accent-color)' }} />
              Throughput (Inference Volume)
            </h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.dailyData || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Bar dataKey="requests" name="Requests" fill="var(--accent-color)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Latency Trend */}
          <div className="chart-card">
            <h2>
              <TrendingUp size={16} style={{ color: '#f97316' }} />
              Latency Trend (ms)
            </h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.dailyData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="avgLatency" name="Avg Latency" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#latencyGlow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Errors */}
          <div className="chart-card" style={{ gridColumn: 'span 2' }}>
            <h2>
              <AlertCircle size={16} style={{ color: '#ef4444' }} />
              System Errors (Failure Tracing)
            </h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.dailyData || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--glass-border)', color: 'var(--text-primary)', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="errors" name="Failed Runs" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Model breakdown table card */}
        <div className="table-card">
          <h2>
            <Cpu size={16} style={{ color: '#a855f7' }} />
            Inference Performance by Model
          </h2>
          <div className="table-wrapper">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Model Name</th>
                  <th>Provider</th>
                  <th>Total Requests</th>
                  <th>Avg Latency</th>
                  <th>Success Rate</th>
                  <th>Total Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data?.modelBreakdown.map((model, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: '600' }}>{model.modelName}</td>
                    <td>
                      <span className="badge provider">{model.provider}</span>
                    </td>
                    <td>{model.requests}</td>
                    <td>{model.avgLatency}ms</td>
                    <td>
                      <span className={`badge ${model.successRate >= 90 ? 'success' : ''}`} style={{ backgroundColor: model.successRate < 90 ? 'rgba(239, 68, 68, 0.12)' : undefined, color: model.successRate < 90 ? '#ef4444' : undefined, border: model.successRate < 90 ? '1px solid rgba(239, 68, 68, 0.2)' : undefined }}>
                        {model.successRate}%
                      </span>
                    </td>
                    <td>{model.totalTokens.toLocaleString()}</td>
                  </tr>
                ))}
                {(!data || data.modelBreakdown.length === 0) && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No inference data captured yet. Send chat messages to populate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
