import { useEffect, useState } from "react";
import { api, formatTime } from "../api/client";

export default function Insights() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.insights().then(setData).catch(console.error);
  }, []);

  if (!data) return <p className="empty">Loading insights…</p>;

  const metrics = [
    { label: "Total Documents", value: data.total_documents },
    { label: "Vector Chunks", value: data.total_chunks },
    { label: "Retrieval Count", value: data.retrieval_count },
    { label: "AI Queries", value: data.ai_queries },
    {
      label: "Avg Response Time",
      value: data.average_response_time_sec ? `${data.average_response_time_sec}s` : "—",
    },
    { label: "Top Queried Topic", value: data.top_queried_topic },
  ];

  return (
    <>
      <header className="page-header">
        <h2>AI Insights</h2>
        <p>Real metrics from your research activity</p>
      </header>

      <section className="metrics">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card saffron">
            <div className="label">{m.label}</div>
            <div className="value" style={{ fontSize: "1.5rem" }}>
              {m.value}
            </div>
          </div>
        ))}
      </section>

      {data.last_indexed && (
        <p className="meta">Last indexed: {formatTime(data.last_indexed)}</p>
      )}
    </>
  );
}
