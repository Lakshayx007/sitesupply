import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-page px-4 py-32 sm:px-6">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-4xl">That page isn't here.</h1>
      <p className="mt-3 text-muted">It may have moved when the console launched.</p>
      <div className="mt-8 flex gap-3">
        <Link to="/" className="btn-primary">Go to the home page</Link>
        <Link to="/console" className="btn-secondary">Open the console</Link>
      </div>
    </div>
  );
}
