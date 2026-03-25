import React from "react";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Store extra info
    this.setState({ errorInfo });

    // 🔹 Log to console (basic requirement)
    console.error("App crashed:", error, errorInfo);

    // 🔹 Optional: send to logging service (Sentry, LogRocket, etc.)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <h1 style={styles.title}>Something went wrong 😢</h1>
          <p style={styles.message}>
            We're sorry — the app encountered an unexpected error.
          </p>

          <button style={styles.button} onClick={this.handleReload}>
            Reload App
          </button>

          {/* Optional: show error in dev mode */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre style={styles.debug}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "#0f172a",
    color: "#fff",
    textAlign: "center",
    padding: "20px",
  },
  title: {
    fontSize: "2rem",
    marginBottom: "10px",
  },
  message: {
    fontSize: "1rem",
    marginBottom: "20px",
    opacity: 0.8,
  },
  button: {
    padding: "10px 20px",
    fontSize: "1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    background: "#2563eb",
    color: "#fff",
  },
  debug: {
    marginTop: "20px",
    textAlign: "left",
    background: "#1e293b",
    padding: "10px",
    borderRadius: "6px",
    maxWidth: "80%",
    overflowX: "auto",
  },
};

export default AppErrorBoundary;