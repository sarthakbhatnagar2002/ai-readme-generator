import os
import sys
import json
import argparse
import tempfile
import pickle
from pathlib import Path
from typing import Dict, Any, Optional, List

# PDF and text processing
from PyPDF2 import PdfReader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Google Gemini and LangChain
import google.generativeai as genai
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate
from langchain.schema import Document

# Environment
from dotenv import load_dotenv
import re

class AdvancedReadmeGenerator:
    def __init__(self, verbose=True):
        """Initialize the advanced README generator with RAG capabilities"""
        self.verbose = verbose  # Control logging output
        self.vector_store = None
        self.embeddings = None
        self.load_environment()
        self.setup_gemini()
        
    def log(self, message):
        """Print message only if verbose mode is enabled"""
        if self.verbose:
            print(message)
        
    def load_environment(self):
        """Load environment variables from .env file or system"""
        # First try to load from script directory (extension folder)
        script_dir = Path(__file__).parent
        env_file = script_dir / '.env'
        
        if env_file.exists():
            load_dotenv(env_file)
            self.log(f"✅ Loaded environment from: {env_file}")
        else:
            # Try current working directory
            cwd_env = Path.cwd() / '.env'
            if cwd_env.exists():
                load_dotenv(cwd_env)
                self.log(f"✅ Loaded environment from: {cwd_env}")
            else:
                self.log("⚠️ No .env file found, checking environment variables...")
        
        # Get API key from environment only
        self.api_key = os.getenv('GOOGLE_API_KEY')
        
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables or .env file. Please set your API key in a .env file or as an environment variable.")
        
        self.log("✅ Google API key loaded successfully")
    
    def setup_gemini(self):
        """Configure Gemini API and embeddings"""
        try:
            # Configure the main Gemini API
            genai.configure(api_key=self.api_key)
            
            # Initialize embeddings with explicit API key and proper configuration
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model="models/embedding-001",
                google_api_key=self.api_key
            )
            
            # Initialize chat model with the correct model name
            self.chat_model = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash", 
                temperature=0.3,
                google_api_key=self.api_key
            )
            
            self.log("✅ Gemini API and embeddings configured successfully")
            
            # Test the embeddings to make sure they work
            try:
                test_embedding = self.embeddings.embed_query("test")
                if test_embedding and len(test_embedding) > 0:
                    self.log("Embeddings test successful")
                else:
                    raise Exception("Embeddings test returned empty result")
            except Exception as e:
                self.log(f"Embeddings test failed: {e}")
                raise Exception(f"Embeddings initialization failed: {e}")
                
        except Exception as e:
            raise Exception(f"Failed to configure Gemini API: {str(e)}")
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text content from PDF file using PyPDF2"""
        try:
            self.log(f"📄 Reading PDF: {pdf_path}")
            text = ""
            with open(pdf_path, 'rb') as file:
                pdf_reader = PdfReader(file)
                
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        page_text = page.extract_text()
                        if page_text.strip():  # Only add non-empty pages
                            text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                    except Exception as e:
                        self.log(f"⚠️ Warning: Could not extract text from page {page_num + 1}: {e}")
                        continue
                
                if not text.strip():
                    raise Exception("No text could be extracted from the PDF")
                
                self.log(f"✅ Extracted {len(text)} characters from PDF ({len(pdf_reader.pages)} pages)")
                return text
                
        except FileNotFoundError:
            raise Exception(f"PDF file not found: {pdf_path}")
        except Exception as e:
            raise Exception(f"Error reading PDF: {str(e)}")
    
    def get_text_chunks(self, text: str) -> List[str]:
        """Split text into manageable chunks for vector processing"""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=10000,  # Larger chunks for code context
            chunk_overlap=1000,  # Overlap to maintain context
            length_function=len,
            separators=["\n\n", "\n", "File:", "---", " ", ""]  # Code-aware separators
        )
        
        chunks = text_splitter.split_text(text)
        self.log(f"📊 Created {len(chunks)} text chunks for processing")
        return chunks
    
    def create_vector_store(self, text_chunks: List[str]) -> bool:
        """Create FAISS vector store from text chunks"""
        try:
            self.log("🔍 Creating vector embeddings...")
            
            # Debug: Check embeddings state
            self.log(f"🔍 Embeddings object: {type(self.embeddings)}")
            self.log(f"🔍 Embeddings exists: {self.embeddings is not None}")
            
            # Ensure embeddings are working
            if self.embeddings is None:
                raise Exception("Embeddings object is None")
            
            # Create documents from chunks
            documents = [Document(page_content=chunk) for chunk in text_chunks]
            self.log(f"📄 Created {len(documents)} documents for embedding")
            
            # Create vector store with retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    self.log(f"🔄 Attempt {attempt + 1}/{max_retries} to create vector store...")
                    if attempt == 0:
                        self.log("🧪 Testing embeddings with single document...")
                        test_embedding = self.embeddings.embed_documents([documents[0].page_content])
                        self.log(f"✅ Test embedding successful, length: {len(test_embedding[0])}")
                    
                    self.vector_store = FAISS.from_documents(documents, self.embeddings)
                    self.log("✅ FAISS vector store created successfully")
                    break
                    
                except Exception as e:
                    self.log(f"⚠️ Attempt {attempt + 1} failed: {e}")
                    if attempt == max_retries - 1:
                        raise e
                    self.log("🔄 Retrying in 3 seconds...")
                    import time
                    time.sleep(3)

            temp_dir = tempfile.mkdtemp()
            self.vector_store_path = os.path.join(temp_dir, "faiss_index")
            self.vector_store.save_local(self.vector_store_path)
            
            self.log(f"✅ Vector store created with {len(text_chunks)} embeddings")
            return True
            
        except Exception as e:
            self.log(f"❌ Error creating vector store: {str(e)}")
            self.log(f"❌ Error type: {type(e)}")
            import traceback
            self.log(f"❌ Full traceback: {traceback.format_exc()}")
            return False
    
    def get_conversational_chain(self):
        """Create the conversational chain for README generation"""
        
        readme_prompt_template = """
You are an expert software developer and technical writer. Based on the provided codebase context, generate a comprehensive and professional README.md file.

Analyze the code context carefully and create a README that includes:

1. **Project Title** - Infer from the codebase structure, package.json, or main files
2. **Description** - Clear overview of what the project does based on the actual code
3. **Features** - Key functionality identified from the source code analysis
4. **Technology Stack** - Languages, frameworks, libraries, and tools used (be specific)
5. **Workflow** - End-to-end process flow of the application, from input parsing and vector creation to response generation and cleanup.
6. **Installation** - Step-by-step setup instructions based on detected dependencies
7. **Usage** - How to run/use the project with code examples where appropriate
8. **Project Structure** - Overview of important directories and files
9. **API Documentation** - If REST endpoints or APIs are detected
10. **Configuration** - Environment variables, config files, or settings found

**Guidelines:**
- Be specific and accurate based on the actual code provided
- Use proper markdown formatting with headers, code blocks, and lists
- Include actual code examples from the codebase when relevant
- Make installation instructions specific to the detected package managers
- If you can't determine something from the code, make reasonable assumptions
- Focus on what the code actually does, not generic descriptions
- Make it professional and comprehensive enough for other developers to understand and contribute

**Code Context:**
{context}

**Question:** {question}

**Generated README.md:**
"""
        
        prompt = PromptTemplate(
            template=readme_prompt_template,
            input_variables=["context", "question"]
        )
        
        chain = load_qa_chain(
            self.chat_model, 
            chain_type="stuff", 
            prompt=prompt
        )
        
        return chain
    
    def analyze_codebase_with_rag(self, user_question: str) -> str:
        """Use RAG to analyze codebase and generate README content"""
        try:
            if not self.vector_store:
                raise Exception("Vector store not initialized. Process PDF first.")
            
            self.log("🔍 Searching for relevant code context...")
            
            # Search for relevant documents
            relevant_docs = self.vector_store.similarity_search(
                user_question, 
                k=10  # Get top 10 most relevant chunks
            )
            
            self.log(f"📄 Found {len(relevant_docs)} relevant code sections")
            
            # Get conversational chain
            chain = self.get_conversational_chain()
            
            self.log("🤖 Generating README content with RAG...")
            
            # Generate response
            response = chain(
                {"input_documents": relevant_docs, "question": user_question},
                return_only_outputs=True
            )
            
            readme_content = response["output_text"].strip()
            
            if not readme_content:
                raise Exception("Empty response from RAG chain")
            
            self.log(f"✅ Generated README content ({len(readme_content)} characters)")
            return readme_content
            
        except Exception as e:
            raise Exception(f"Failed to analyze codebase with RAG: {str(e)}")
    
    def cleanup(self):
        """Clean up temporary files and vector store"""
        try:
            if hasattr(self, 'vector_store_path') and os.path.exists(self.vector_store_path):
                import shutil
                shutil.rmtree(os.path.dirname(self.vector_store_path))
                self.log("Cleaned up temporary vector store")
        except Exception as e:
            self.log(f"Warning: Could not clean up temporary files: {e}")
    
    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """Main method to process PDF and generate README using RAG"""
        try:
            self.log(f"Processing PDF with RAG: {pdf_path}")
            
            pdf_content = self.extract_text_from_pdf(pdf_path)

            text_chunks = self.get_text_chunks(pdf_content)
            if not self.create_vector_store(text_chunks):
                raise Exception("Failed to create vector store")
            
            readme_question = """
            Analyze this codebase comprehensively and generate a detailed README.md file. 
            I need a professional README that covers:
            - What this project does and its main purpose
            - The technologies and frameworks used
            - How to install and set up the project
            - How to use and run the project
            - The project structure and important files
            - Any APIs or endpoints if it's a web service
            - Configuration requirements

            Pay special attention to:
        
            **WORKFLOW ANALYSIS**:
            - How do the files and components work together as a system?
            - What is the complete data/execution flow from input to output?
            - Which files are main entry points vs support modules?
            - How do different classes/functions call and depend on each other?
            - What happens step-by-step when the system runs?
            - How are external dependencies integrated?
            
            **STANDARD README SECTIONS**:
            - Project purpose and functionality
            - Technology stack and dependencies  
            - Installation and setup procedures
            - Usage instructions with examples
            - Project structure and file organization
            - API endpoints or interfaces
            - Configuration requirements
            
            **OUTPUT REQUIREMENTS**:
            - Include a dedicated "System Workflow" or "How It Works" section
            - Use diagrams or flowcharts in text form where helpful
            - Be specific about file relationships and dependencies
            - Focus on actual code behavior rather than generic descriptions
            - Make it comprehensive enough for new developers to understand the system
            
            Please be specific and detailed, focusing on the actual code functionality rather than generic descriptions.
            """
            
            # Step 5: Generate README using RAG
            readme_content = self.analyze_codebase_with_rag(readme_question)
            
            # Step 6: Post-process the content to ensure it's well-formatted
            readme_content = self.post_process_readme(readme_content)
            
            return {
                "success": True,
                "content": readme_content,
                "message": "README generated successfully using RAG analysis",
                "stats": {
                    "pdf_text_length": len(pdf_content),
                    "chunks_created": len(text_chunks),
                    "readme_length": len(readme_content)
                }
            }
            
        except Exception as e:
            error_msg = str(e)
            self.log(f"❌ Error: {error_msg}")
            return {
                "success": False,
                "content": None,
                "message": error_msg
            }
        finally:
            # Always cleanup temporary files
            self.cleanup()
    
    def post_process_readme(self, content: str) -> str:
        """Post-process the generated README to ensure good formatting"""
        
        # Ensure it starts with a proper title
        if not content.strip().startswith('#'):
            # Try to extract project name from content or use generic title
            lines = content.strip().split('\n')
            first_line = lines[0] if lines else "Project"
            content = f"# {first_line}\n\n" + content
        
        # Ensure proper spacing around headers
        content = re.sub(r'\n(#{1,6})\s*([^\n]+)\n', r'\n\n\1 \2\n\n', content)
        
        # Clean up multiple consecutive newlines
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        # Ensure code blocks are properly formatted
        content = re.sub(r'```(\w+)?\n(.*?)\n```', r'```\1\n\2\n```', content, flags=re.DOTALL)
        
        return content.strip()

def main():
    """Main function to handle command line execution"""
    parser = argparse.ArgumentParser(description='Generate README from PDF using RAG analysis')
    parser.add_argument('pdf_path', help='Path to the PDF file containing codebase summary')
    parser.add_argument('--json', action='store_true', help='Output result as JSON')
    parser.add_argument('--output', '-o', help='Output file path for README content')
    parser.add_argument('--question', help='Custom question for README generation')
    parser.add_argument('--clean', action='store_true', help='Output only the README content without logs')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed processing logs')
    
    args = parser.parse_args()
    
    try:
        # Determine verbose mode - only verbose if explicitly requested or not in clean mode
        verbose_mode = args.verbose and not args.clean
        
        if not args.json and not args.clean:
            print(f"🚀 Starting README generation for: {args.pdf_path}")
        
        # Create generator instance with appropriate verbosity
        generator = AdvancedReadmeGenerator(verbose=verbose_mode)
        
        # Process the PDF
        result = generator.process_pdf(args.pdf_path)
        
        if args.json:
            # Output as JSON (for VS Code extension) - but remove stats if clean mode
            if args.clean and "stats" in result:
                del result["stats"]
            print(json.dumps(result, indent=2))
        elif args.clean:
            # Clean output mode - only README content
            if result["success"]:
                print(result["content"])
            else:
                print(f"Error: {result['message']}", file=sys.stderr)
                sys.exit(1)
        else:
            # Human-readable output with full details
            if result["success"]:
                print("✅ README generated successfully using RAG analysis!")
                
                if "stats" in result:
                    stats = result["stats"]
                    print(f"📊 Processing stats:")
                    print(f"   - PDF text: {stats['pdf_text_length']:,} characters")
                    print(f"   - Text chunks: {stats['chunks_created']}")
                    print(f"   - README: {stats['readme_length']:,} characters")
                
                if args.output:
                    with open(args.output, 'w', encoding='utf-8') as f:
                        f.write(result["content"])
                    print(f"📝 README saved to: {args.output}")
                else:
                    print("\n" + "="*70)
                    print("GENERATED README CONTENT:")
                    print("="*70)
                    print(result["content"])
            else:
                print(f"❌ Failed to generate README: {result['message']}")
                sys.exit(1)
                
    except Exception as e:
        error_result = {
            "success": False,
            "content": None,
            "message": f"Script error: {str(e)}"
        }
        
        if args.json:
            if args.clean and "stats" in error_result:
                del error_result["stats"]
            print(json.dumps(error_result, indent=2))
        else:
            print(f"❌ Error: {str(e)}")
        
        sys.exit(1)

if __name__ == "__main__":
    main()
