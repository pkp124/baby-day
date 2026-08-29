import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="onboard">
          <div className="onboard-card">
            <h1 className="wordmark">Baby Day</h1>
            <p className="warn-text">{this.state.error.message}</p>
            <div className="stack">
              <button className="primary" type="button" onClick={() => this.setState({ error: null })}>
                Try again
              </button>
              <button className="secondary" type="button" onClick={() => window.location.reload()}>
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
