"""
S3 Storage Utility for JurisAI
==============================
Central boto3 wrapper for all document storage operations.

Configuration (via environment variables or .env):
    AWS_ACCESS_KEY_ID       – AWS access key
    AWS_SECRET_ACCESS_KEY   – AWS secret key
    AWS_REGION              – AWS region (default: us-east-1)
    S3_BUCKET_NAME          – S3 bucket name (default: lexassist)

S3 folder layout:
    Documents/  – all uploaded PDFs
                  Pattern: {client_id}_{case_id}_{doc_id}.pdf  (case document)
                            {user_id}_{doc_id}.pdf              (standalone upload)
"""

import os
import logging

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

S3_BUCKET = os.getenv("S3_BUCKET_NAME", "lexassist")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
PRESIGNED_EXPIRY = int(os.getenv("S3_PRESIGNED_EXPIRY_SECONDS", "3600"))  # 1 hour

# Single folder for all uploaded documents
FOLDER_DOCUMENTS = "Documents"


def _get_client():
    """Create and return a boto3 S3 client."""
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


# ---------------------------------------------------------------------------
# Key Builders
# ---------------------------------------------------------------------------

def build_case_key(client_id: str, case_id: str, document_id: str) -> str:
    """Case document: Documents/{client_id}_{case_id}_{document_id}.pdf"""
    return f"{FOLDER_DOCUMENTS}/{client_id}_{case_id}_{document_id}.pdf"


def build_upload_key(user_id: str, document_id: str) -> str:
    """Standalone upload: Documents/{user_id}_{document_id}.pdf"""
    return f"{FOLDER_DOCUMENTS}/{user_id}_{document_id}.pdf"


# ---------------------------------------------------------------------------
# Core Operations
# ---------------------------------------------------------------------------

def upload_pdf(key: str, data: bytes, bucket: str = S3_BUCKET) -> str:
    """Upload PDF bytes to S3 under *key*. Returns the S3 key."""
    if not data:
        raise ValueError("Cannot upload empty file data.")
    s3 = _get_client()
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType="application/pdf",
    )
    logger.info("Uploaded %d bytes to s3://%s/%s", len(data), bucket, key)
    return key


def download_pdf(key: str, bucket: str = S3_BUCKET) -> bytes:
    """Download an S3 object and return its bytes."""
    s3 = _get_client()
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        data = response["Body"].read()
        logger.info("Downloaded %d bytes from s3://%s/%s", len(data), bucket, key)
        return data
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        if error_code in ("NoSuchKey", "404"):
            raise FileNotFoundError(f"S3 object not found: s3://{bucket}/{key}") from exc
        raise


def delete_pdf(key: str, bucket: str = S3_BUCKET) -> None:
    """Delete an S3 object by key."""
    s3 = _get_client()
    try:
        s3.delete_object(Bucket=bucket, Key=key)
        logger.info("Deleted s3://%s/%s", bucket, key)
    except ClientError as exc:
        logger.warning("Failed to delete s3://%s/%s: %s", bucket, key, exc)
        raise


def file_exists(key: str, bucket: str = S3_BUCKET) -> bool:
    """Return True if the S3 object exists."""
    s3 = _get_client()
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError:
        return False


def list_documents(prefix: str = FOLDER_DOCUMENTS, bucket: str = S3_BUCKET) -> list[dict]:
    """List all PDF objects under *prefix*."""
    s3 = _get_client()
    results = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix + "/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.lower().endswith(".pdf"):
                continue
            filename = key.split("/")[-1]
            results.append({
                "key": key,
                "filename": filename,
                "size_bytes": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            })
    return results


def generate_presigned_url(
    key: str,
    bucket: str = S3_BUCKET,
    expiry: int = PRESIGNED_EXPIRY,
) -> str:
    """Generate a time-limited presigned GET URL for an S3 object."""
    s3 = _get_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expiry,
    )


def get_size_label(size_bytes: int) -> str:
    """Human-readable file size."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{round(size_bytes / 1024, 1)} KB"
    return f"{round(size_bytes / (1024 * 1024), 1)} MB"
