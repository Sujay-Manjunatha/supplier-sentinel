import { Component, type ReactNode } from "react";

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    // Ignore DOM mutations caused by browser extensions (Grammarly, translate, etc.)
    if (error.message?.includes("removeChild") || error.message?.includes("insertBefore")) {
      return { error: null };
    }
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("App error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-lg w-full space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
            <p className="text-muted-foreground text-sm font-mono bg-muted p-4 rounded break-all">
              {this.state.error.message}
            </p>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm"
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
