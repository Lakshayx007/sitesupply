import { CloudRain, History, Route, Truck } from "lucide-react";

/* Ravi's slab pour, from section 1 of docs/explainer.md. */

const TIMELINE = [
  { time: "Day before", text: "A slab pour is planned for 9:00 on a 20-floor residential project in Bengaluru. Twenty workers, a pump and a crane are booked." },
  { time: "8:30", text: "The ready-mix concrete truck is due. Nothing arrives. Ravi calls the vendor and the line is busy." },
  { time: "8:45", text: "The truck finally leaves the plant." },
  { time: "9:00", text: "Pour time. The crew waits, and the pump is paid for by the hour." },
  { time: "9:15", text: "Ravi finds out the truck is stuck in traffic 40 km away." },
];

const SIGNALS = [
  { icon: Truck, text: "The truck had not left on time" },
  { icon: History, text: "The vendor had been late on several recent orders" },
  { icon: CloudRain, text: "It was monsoon season" },
  { icon: Route, text: "The site was far from the plant" },
];

export function Story() {
  return (
    <section aria-labelledby="story-title" className="relative overflow-hidden border-y border-line bg-panel">
      <div aria-hidden="true" className="grid-bg fade-y absolute inset-0 opacity-50" />
      <div className="relative mx-auto grid max-w-page gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <div>
          <p className="text-sm font-medium text-muted">Why we built it</p>
          <h2 id="story-title" className="display mt-3 text-4xl sm:text-5xl">
            Ravi's slab pour
          </h2>
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted">
            Ravi is a site engineer. Tomorrow at 9 am he pours a slab, and the ready-mix truck is meant to arrive at 8:30.
            Ready-mix concrete cannot wait forever: a common rule of thumb from India's ready-mix code (IS 4926) is that
            transit should stay within about 2 hours of mixing in normal weather. A late truck can mean a wasted load.
          </p>
        </div>

        <ol className="relative space-y-7 border-l border-line pl-8">
          {TIMELINE.map((t, i) => (
            <li key={t.time} className="relative">
              <span
                aria-hidden="true"
                className={`absolute -left-[37px] top-1.5 h-[9px] w-[9px] rounded-full ring-4 ring-panel ${
                  i === TIMELINE.length - 1 ? "bg-accent" : "bg-panel-muted"
                }`}
              />
              <p className="num text-sm font-semibold text-ink">{t.time}</p>
              <p className="mt-1 text-base leading-relaxed text-muted">{t.text}</p>
            </li>
          ))}
        </ol>

        <div className="lg:col-span-2">
          <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {SIGNALS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 bg-panel p-5">
                <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
                <p className="text-sm leading-relaxed text-ink">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-3xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
            The delay was visible earlier. Nobody put the signals together and told Ravi in time. SiteSupply's job is to
            do exactly that.
          </p>
        </div>
      </div>
    </section>
  );
}
