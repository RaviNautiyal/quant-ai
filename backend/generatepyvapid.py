from py_vapid import Vapid
 
def generate():
    vapid = Vapid()
    vapid.generate_keys()
 
    private_key = vapid.private_key.private_bytes(
        encoding=__import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding"]).Encoding.PEM,
        format=__import__("cryptography.hazmat.primitives.serialization", fromlist=["PrivateFormat"]).PrivateFormat.PKCS8,
        encryption_algorithm=__import__("cryptography.hazmat.primitives.serialization", fromlist=["NoEncryption"]).NoEncryption(),
    )
 
    # URL-safe base64 public key (what browsers expect)
    import base64
    pub_bytes  = vapid.public_key.public_bytes(
        encoding=__import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding"]).Encoding.X962,
        format=__import__("cryptography.hazmat.primitives.serialization", fromlist=["PublicFormat"]).PublicFormat.UncompressedPoint,
    )
    pub_b64 = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode("utf-8")
 
    print("\n" + "="*60)
    print("VAPID keys generated. Paste these into your env files:")
    print("="*60)
    print(f"\n# ── .env (backend) ──────────────────────────────────")
    print(f"VAPID_PRIVATE_KEY={private_key.decode().strip()}")
    print(f"\n# ── .env.local (Next.js frontend) ───────────────────")
    print(f"NEXT_PUBLIC_VAPID_PUBLIC_KEY={pub_b64}")
    print("\n" + "="*60)
    print("IMPORTANT: Never commit these keys to Git.\n")
 
if __name__ == "__main__":
    generate()