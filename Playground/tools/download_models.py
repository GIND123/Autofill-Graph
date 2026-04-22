import os


def _maybe_set_hf_home() -> None:
    # Optional: set `HF_HOME` if you want model caches in a known location.
    # By default, Hugging Face uses the user cache directory.
    hf_home = os.environ.get("HF_HOME", "").strip()
    if not hf_home:
        return
    os.environ["HF_HOME"] = hf_home


def main() -> None:
    _maybe_set_hf_home()

    # MiniLM retriever
    from sentence_transformers import SentenceTransformer

    SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    print("OK: sentence-transformers/all-MiniLM-L6-v2")

    # CLIP document matcher
    from transformers import CLIPModel, CLIPProcessor

    CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    print("OK: openai/clip-vit-base-patch32")


if __name__ == "__main__":
    main()
