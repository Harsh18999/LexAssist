import os
from dotenv import load_dotenv

load_dotenv()

from langchain_aws import BedrockEmbeddings

# ---------------------------------------------------------------------------
# Bedrock Titan Embeddings — 1024-dim (matches LEGAL_VECTOR_DB table)
# ---------------------------------------------------------------------------

_bedrock_embeddings = BedrockEmbeddings(
    model_id="amazon.titan-embed-text-v2:0",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
)