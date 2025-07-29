import os
import sys
import google.generativeai as genai
from langchain_google_genai import GoogleGenerativeAIEmbeddings

def main():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("❌ GOOGLE_API_KEY not found in environment variables or .env file.")
        sys.exit(1)

    print(f"✅ API Key loaded. Length: {len(api_key)}")

    try:
        genai.configure(api_key=api_key)
        print("✅ Gemini API configured.")

        # Try default embeddings initialization (no model specified)
        embeddings = GoogleGenerativeAIEmbeddings()
        print(f"Embeddings object: {embeddings}")

        if embeddings is None:
            print("❌ Embeddings initialization failed: received None")
            sys.exit(1)
        else:
            # Check if 'embed_documents' attribute exists
            if hasattr(embeddings, 'embed_documents'):
                print("✅ 'embed_documents' method found on embeddings object.")
            else:
                print("❌ 'embed_documents' method NOT found on embeddings object.")
                sys.exit(1)

        print("🎉 Embeddings initialized successfully. Your setup looks correct.")
    except Exception as e:
        print(f"❌ Exception during embeddings setup: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
