import os
import sys
import json
import re
from typing import Dict, Any, List
from langchain_text_splitters import RecursiveCharacterTextSplitter
import google.generativeai as genai
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

class AdvancedReadmeGenerator:
    def __init__(self):
        self.vector_store = None
        self.embeddings = None
        self.setup_api_key()
        self.setup_gemini()

    def setup_api_key(self):
        self.api_key = os.environ.get('codeSummaryGenerator.apiKey')
        if not self.api_key:
            raise ValueError("API_KEY not found in environment variables.")

    def setup_gemini(self):
        try:
            genai.configure(api_key=self.api_key)
            self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=self.api_key
            )
            self.chat_model = ChatGoogleGenerativeAI(
            model="gemini-flash-lite-latest",
            temperature=0.3,
            google_api_key=self.api_key
            )
        except Exception as e:
            raise Exception(f"Failed to configure Gemini API: {str(e)}")

    def load_codebase_json(self, json_path: str) -> str:
        try:
            with open(json_path, 'r', encoding='utf-8') as file:
                codebase_data = json.load(file)
            return self.format_codebase_data(codebase_data)
        except FileNotFoundError:
            raise Exception(f"Codebase JSON file not found: {json_path}")
        except Exception as e:
            raise Exception(f"Error reading codebase JSON: {str(e)}")

    def format_codebase_data(self, codebase_data: Dict) -> str:
        MAX_CHARS_PER_FILE = 6000  # cap each file's content to control token usage

        sections = []
        for key in ['projectName', 'description']:
            if key in codebase_data:
                label = "PROJECT" if key == 'projectName' else key.upper()
                sections.append(f"=== {label}: {codebase_data[key]} ===")
        if 'packageJson' in codebase_data:
            sections.append("=== PACKAGE.JSON ===")
            sections.append(json.dumps(codebase_data['packageJson'], indent=2))
        if 'structure' in codebase_data:
            sections.append("=== STRUCTURE ===")
            sections.append(json.dumps(codebase_data['structure'], indent=2))

        if 'files' in codebase_data:
            sections.append("=== FILES ===")
            files = codebase_data['files']
            if isinstance(files, dict):
                for file_path, file_content in files.items():
                    sections.append(f"--- {file_path} ---")
                    content = file_content['content'] if isinstance(file_content, dict) and 'content' in file_content else str(file_content)
                    if len(content) > MAX_CHARS_PER_FILE:
                        content = content[:MAX_CHARS_PER_FILE] + f"\n... [truncated, {len(content) - MAX_CHARS_PER_FILE} more characters omitted]"
                    sections.append(content)
            elif isinstance(files, list):
                for file_entry in files:
                    file_path = file_entry.get('path', file_entry.get('name', 'unknown'))
                    sections.append(f"--- {file_path} ---")
                    if file_entry.get('isText', True):
                        content = str(file_entry.get('content', ''))
                        if len(content) > MAX_CHARS_PER_FILE:
                            content = content[:MAX_CHARS_PER_FILE] + f"\n... [truncated, {len(content) - MAX_CHARS_PER_FILE} more characters omitted]"
                        sections.append(content)
                    else:
                        sections.append('[binary file omitted]')

        config_keys = ['tsconfig', 'webpack', 'vite', 'eslint', 'prettier']
        for config in config_keys:
            if config in codebase_data:
                sections.append(f"=== {config.upper()} ===")
                sections.append(json.dumps(codebase_data[config], indent=2))
        return "\n".join(sections)

    def get_text_chunks(self, text: str) -> List[str]:
        text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=20000,
        chunk_overlap=500,
        length_function=len,
        separators=["\n=== ", "\n--- FILE:", "\n---", "\n\n", "\n", " ", ""]
    )
        return text_splitter.split_text(text)

    def create_vector_store(self, text_chunks: List[str]) -> bool:
        try:
            documents = [Document(page_content=chunk) for chunk in text_chunks]
            self.vector_store = FAISS.from_documents(documents, self.embeddings)
            return True
        except Exception as e:
            print(f"Failed to create vector store: {e}", file=sys.stderr)
            return False

    def get_conversational_chain(self):
        readme_prompt_template = """
        You are an expert software developer and technical writer. Based on the provided codebase context, generate a comprehensive and professional README.md file.

        Analyze the code context carefully and create a README that includes:
        1. **Project Title** - Infer from the codebase structure, package.json, or main files
        2. **Description** - Clear overview of what the project does based on the actual code
        3. **Features** - Key functionality identified from the source code analysis
        4. **Technology Stack** - Languages, frameworks, libraries, and tools used (be specific)
        5. **Workflow** - End-to-end process flow of the application
        6. **Installation** - Step-by-step setup instructions based on detected dependencies
        7. **Usage** - How to run/use the project with code examples where appropriate
        8. **Project Structure** - Overview of important directories and files
        9. **API Documentation** - If REST endpoints or APIs are detected
        10. **Configuration** - Environment variables, config files, or settings found
        11. **License** - If a LICENSE file exists in the context, state its type. If not, write "No license specified."

        **Guidelines:**
        - Be specific and accurate based on the actual code provided
        - Use proper markdown formatting with headers, code blocks, and lists
        - Include actual code examples from the codebase when relevant
        - Make installation instructions specific to the detected package managers
        - Focus on what the code actually does, not generic descriptions
        - Make it professional and comprehensive enough for other developers
        - If specific request/response formats, example values, or credentials are not explicitly present in the code context, clearly label them as "example" or "inferred" rather than presenting them as verified facts
        - If a file's content appears truncated or partial in the provided context, do not assume unseen parts of that file follow the same pattern and describe only what is actually visible

        Code context:
        {context}

        Question: {input}

        Generated README.md:
        """
        prompt = ChatPromptTemplate.from_template(readme_prompt_template)
        return create_stuff_documents_chain(self.chat_model, prompt)

    def generate_readme(self, json_path: str) -> Dict[str, Any]:
        try:
            formatted_content = self.load_codebase_json(json_path)
            text_chunks = self.get_text_chunks(formatted_content)
            if not self.create_vector_store(text_chunks):
                raise Exception("Failed to create vector store")
            readme_question = """
            Analyze this codebase comprehensively and generate a detailed README.md file covering:
            - Project purpose and main functionality
            - Technologies and frameworks used
            - Installation and setup procedures
            - Usage instructions with examples
            - Project structure and important files
            - APIs or endpoints if applicable
            - Configuration requirements
            - System workflow and how components work together

            Focus on actual code behavior rather than generic descriptions.
            """
            relevant_docs = self.vector_store.similarity_search(readme_question, k=6)
            chain = self.get_conversational_chain()
            response = chain.invoke({"context": relevant_docs, "input": readme_question})
            readme_content = response.strip()
            if not readme_content:
                raise Exception("Empty response from AI")
            readme_content = self.post_process_readme(readme_content)
            return {
                "success": True,
                "content": readme_content,
                "message": "README generated successfully",
                "stats": {
                    "chunks_created": len(text_chunks),
                    "readme_length": len(readme_content)
                }
            }
        except Exception as e:
            return {
                "success": False,
                "content": None,
                "message": str(e)
            }

    def post_process_readme(self, content: str) -> str:
        content = content.strip()
        content = re.sub(r'\n{3,}', '\n\n', content)
        return content

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    if len(sys.argv) < 2:
        print("Error: no JSON path provided", file=sys.stderr)
        sys.exit(1)

    json_path = sys.argv[1]

    try:
        generator = AdvancedReadmeGenerator()
        result = generator.generate_readme(json_path)
        if result["success"]:
            print(result["content"])
        else:
            print(f"Error: {result['message']}", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()