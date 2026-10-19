import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import competitive from "../../docs/competitive_scan.md?raw";
import metrics from "../../docs/metrics.md?raw";
import metricsTree from "../../docs/metrics_tree.md?raw";
import prd from "../../docs/prd.md?raw";
import research from "../../docs/user_research.md?raw";
import rice from "../../docs/rice.md?raw";
import roadmap from "../../docs/roadmap.md?raw";
import stories from "../../docs/user_stories.md?raw";

const DOCS = [
  { key: "prd", file: "prd.md", label: "PRD", md: prd },
  { key: "stories", file: "user_stories.md", label: "User stories", md: stories },
  { key: "rice", file: "rice.md", label: "RICE", md: rice },
  { key: "tree", file: "metrics_tree.md", label: "Metrics tree", md: metricsTree },
  { key: "roadmap", file: "roadmap.md", label: "Roadmap", md: roadmap },
  { key: "competitive", file: "competitive_scan.md", label: "Competitive scan", md: competitive },
  { key: "research", file: "user_research.md", label: "Research plan", md: research },
  { key: "metrics", file: "metrics.md", label: "Metrics and SQL", md: metrics },
];

/** Tabs that render the markdown files in docs/. */
export function Documents() {
  const [tab, setTab] = useState("prd");
  const doc = DOCS.find((d) => d.key === tab)!;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div role="tablist" aria-label="Documents" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
        {DOCS.map((d) => (
          <button
            key={d.key}
            role="tab"
            id={`tab-${d.key}`}
            aria-selected={tab === d.key}
            aria-controls="doc-panel"
            onClick={() => setTab(d.key)}
            className={`-mb-px whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm ${
              tab === d.key ? "border-primary-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div id="doc-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="md-doc scroll-thin max-h-[720px] overflow-y-auto px-5 py-6 sm:px-8">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const target = DOCS.find((d) => href?.endsWith(d.file));
              if (target)
                return (
                  <button className="link" onClick={() => setTab(target.key)}>
                    {children}
                  </button>
                );
              return (
                <a href={href} className="link" target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            },
            table: ({ children }) => (
              <div className="scroll-thin my-5 overflow-x-auto rounded-lg border border-line">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {doc.md}
        </ReactMarkdown>
      </div>
    </div>
  );
}
