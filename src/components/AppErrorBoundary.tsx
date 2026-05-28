import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Unexpected render error.",
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("TicketTrail render crash:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recovery</p>
            <h3>Something went wrong while rendering the workspace</h3>
          </div>
        </div>
        <div className="empty-state">
          <strong>The app hit a render error.</strong>
          <p>{this.state.errorMessage || "Unknown render error."}</p>
          <div className="export-row">
            <button className="ghost-button" onClick={this.handleRetry} type="button">
              Try again
            </button>
            <button className="primary-button" onClick={this.handleReload} type="button">
              Reload app
            </button>
          </div>
        </div>
      </section>
    );
  }
}
