import os
import sys
import json
import argparse
import tempfile
import pickle
from pathlib import Path
from typing import Dict, Any, Optional, List

# Text processing (removed PDF dependencies)
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Google Gemini and LangChain
import google.generativeai as genai
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate
from langchain.schema import Document

# Environment (keeping for backward compatibility but not required)
from dotenv import load_dotenv
import re

class AdvancedReadmeGenerator:
    def __init__(self, api_key: str = None, verbose=True):
        """Initialize the advanced README generator with RAG capabilities"""
        self.verbose = verbose  # Control logging output
        self.vector_store = None
        self.embeddings = None
        self.api_key = api_key  # Accept API key directly
        self.setup_gemini()
        
    def log(self, message):
        """Print message only if verbose mode is enabled"""
        if self.verbose:
            print(message)
        
    def setup_gemini(self):
        """Configure Gemini API and embeddings using provided API key"""
        try:
            # Use the provided API key, no need to load from environment
            if not self.api_key:
                raise ValueError("API key not provided. Please set your Gemini API key in VS Code settings.")
            
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
                    self.log("✅ Embeddings test successful")
                else:
                    raise Exception("Embeddings test returned empty result")
            except Exception as e:
                self.log(f"❌ Embeddings test failed: {e}")
                raise Exception(f"Embeddings initialization failed: {e}")
                
        except Exception as e:
            raise Exception(f"Failed to configure Gemini API: {str(e)}")
    
    def load_codebase_from_json(self, json_path: str) -> str:
        """Load and process codebase data from JSON file"""
        try:
            self.log(f"📄 Reading JSON codebase data: {json_path}")
            
            with open(json_path, 'r', encoding='utf-8') as file:
                codebase_data = json.load(file)
            
            # Extract meaningful text from the JSON structure
            text_content = self.convert_json_to_text(codebase_data)
            
            self.log(f"✅ Loaded codebase data with {len(text_content)} characters")
            return text_content
                
        except FileNotFoundError:
            raise Exception(f"JSON file not found: {json_path}")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON format: {str(e)}")
        except Exception as e:
            raise Exception(f"Error reading JSON: {str(e)}")
    
    def convert_json_to_text(self, codebase_data: Dict[str, Any]) -> str:
        """Convert the JSON codebase data to structured text for processing"""
        text_parts = []
        
        # Add project metadata
        text_parts.append("=== PROJECT METADATA ===")
        text_parts.append(f"Root Directory: {codebase_data.get('rootDirectory', 'N/A')}")
        text_parts.append(f"Timestamp: {codebase_data.get('timestamp', 'N/A')}")
        
        # Add summary information
        if 'summary' in codebase_data:
            summary = codebase_data['summary']
            text_parts.append("\n=== PROJECT SUMMARY ===")
            text_parts.append(f"Total Files: {summary.get('totalFiles', 0)}")
            text_parts.append(f"Total Directories: {summary.get('totalDirectories', 0)}")
            text_parts.append(f"Total Size: {summary.get('totalSize', 0)} bytes")
            
            if 'fileTypes' in summary:
                text_parts.append("\nFile Types:")
                for ext, count in summary['fileTypes'].items():
                    text_parts.append(f"  {ext}: {count} files")
        
        # Add directory structure
        if 'directories' in codebase_data:
            text_parts.append("\n=== DIRECTORY STRUCTURE ===")
            for directory in codebase_data['directories']:
                text_parts.append(f"Directory: {directory.get('path', 'N/A')}")
        
        # Add file contents - this is the most important part
        if 'files' in codebase_data:
            text_parts.append("\n=== SOURCE CODE FILES ===")
            
            for file_data in codebase_data['files']:
                file_path = file_data.get('path', 'unknown')
                file_name = file_data.get('name', 'unknown')
                file_size = file_data.get('size', 0)
                file_extension = file_data.get('extension', '')
                file_lines = file_data.get('lines', 0)
                is_text = file_data.get('isText', False)
                file_content = file_data.get('content', '')
                
                text_parts.append(f"\n--- FILE: {file_path} ---")
                text_parts.append(f"Name: {file_name}")
                text_parts.append(f"Extension: {file_extension}")
                text_parts.append(f"Size: {file_size} bytes")
                text_parts.append(f"Lines: {file_lines}")
                text_parts.append(f"Is Text File: {is_text}")
                
                # Include file content if it's a text file and not too large
                if is_text and file_content and file_size < 500000:  # Skip very large files
                    text_parts.append("Content:")
                    text_parts.append(file_content)
                elif not is_text:
                    text_parts.append("Content: [Binary file - content not included]")
                elif file_size >= 500000:
                    text_parts.append("Content: [Large file - content truncated for processing]")
                else:
                    text_parts.append("Content: [No content available]")
                
                text_parts.append("--- END FILE ---\n")
        
        return "\n".join(text_parts)
    
    def get_text_chunks(self, text: str) -> List[str]:
        """Split text into manageable chunks for vector processing"""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=10000,  # Larger chunks for code context
            chunk_overlap=1000,  # Overlap to maintain context
            length_function=len,
            separators=["\n\n", "\n", "--- FILE:", "===", "---", " ", ""]  # Code-aware separators
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
                raise Exception("Vector store not initialized. Process JSON first.")
            
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
                self.log("🧹 Cleaned up temporary vector store")
        except Exception as e:
            self.log(f"Warning: Could not clean up temporary files: {e}")
    
    def process_json(self, json_path: str) -> Dict[str, Any]:
        """Main method to process JSON codebase data and generate README using RAG"""
        try:
            self.log(f"🚀 Processing JSON codebase data with RAG: {json_path}")
            
            # Load and convert JSON to text
            codebase_text = self.load_codebase_from_json(json_path)

            # Split into chunks for vector processing
            text_chunks = self.get_text_chunks(codebase_text)
            if not self.create_vector_store(text_chunks):
                raise Exception("Failed to create vector store")
            
            # Generate README using RAG
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
            
            # Generate README using RAG
            readme_content = self.analyze_codebase_with_rag(readme_question)
            
            # Post-process the content to ensure it's well-formatted
            readme_content = self.post_process_readme(readme_content)
            
            return {
                "success": True,
                "content": readme_content,
                "message": "README generated successfully using RAG analysis",
                "stats": {
                    "json_text_length": len(codebase_text),
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
    parser = argparse.ArgumentParser(description='Generate README from JSON codebase data using RAG analysis')
    parser.add_argument('json_path', help='Path to the JSON file containing codebase data')
    parser.add_argument('api_key', help='Gemini API key for AI processing')
    parser.add_argument('--output', '-o', help='Output file path for README content')
    parser.add_argument('--question', help='Custom question for README generation')
    parser.add_argument('--clean', action='store_true', help='Output only the README content without logs')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed processing logs')
    
    args = parser.parse_args()
    
    try:
        # Determine verbose mode - only verbose if explicitly requested or not in clean mode
        verbose_mode = args.verbose and not args.clean
        
        if not args.clean:
            print(f"🚀 Starting README generation for: {args.json_path}")
        
        # Create generator instance with API key and appropriate verbosity
        generator = AdvancedReadmeGenerator(api_key=args.api_key, verbose=verbose_mode)
        
        # Process the JSON file
        result = generator.process_json(args.json_path)
        
        if args.clean:
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
                    print(f"   - JSON text: {stats['json_text_length']:,} characters")
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
        
        if args.clean:
            print(f"Error: {str(e)}", file=sys.stderr)
        else:
            print(f"❌ Error: {str(e)}")
        
        sys.exit(1)

if __name__ == "__main__":
    main()