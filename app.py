"""
JurisAI entry point.

Do NOT use: streamlit run app.py

Use instead:
  python app.py              → API + built UI at http://127.0.0.1:8000
  cd frontend && npm run dev → dev UI at http://localhost:5173
"""

import os
import sys


def _started_by_streamlit():
    return (
        os.environ.get("STREAMLIT_SERVER_PORT") is not None
        or "streamlit.runtime" in sys.modules
        or "streamlit" in sys.modules
    )


if __name__ == "__main__":
    if _started_by_streamlit():
        import streamlit as st

        st.set_page_config(page_title="JurisAI", layout="wide")
        st.title("JurisAI")
        st.error("This project no longer uses Streamlit.")
        st.markdown(
            """
            **How to run JurisAI**

            1. Start the backend (in project folder):
            ```
            python app.py
            ```
            Then open **http://127.0.0.1:8000**

            2. For frontend hot-reload during development:
            ```
            cd frontend
            npm run dev
            ```
            Then open **http://localhost:5173**
            """
        )
        st.stop()

    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
    )
