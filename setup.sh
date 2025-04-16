
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}Creating xprinto project structure...${NC}"




# Create source directories
mkdir -p src/syntax src/pdf src/utils
echo -e "${GREEN}Created source directories${NC}"

# Create empty files for each module
touch src/index.ts
touch src/cli.ts
touch src/file-reader.ts
touch src/syntax/highlighter.ts
touch src/pdf/generator.ts
touch src/pdf/page.ts
touch src/pdf/toc.ts
touch src/utils/logger.ts
touch tsconfig.json
touch README.md
echo -e "${GREEN}Created empty files${NC}"

# Initialize package.json
npm init -y
echo -e "${GREEN}Initialized package.json${NC}"


# Add dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install commander fs-extra glob highlight.js pdfkit
npm install --save-dev @types/fs-extra @types/glob @types/node @types/pdfkit jest ts-jest ts-node typescript
echo -e "${GREEN}Installed dependencies${NC}"

# Now write the code files
echo "// Copy the content for each file here" > src/index.ts
echo "// Copy the content for each file here" > src/cli.ts
echo "// Copy the content for each file here" > src/file-reader.ts
echo "// Copy the content for each file here" > src/syntax/highlighter.ts
echo "// Copy the content for each file here" > src/pdf/generator.ts
echo "// Copy the content for each file here" > src/pdf/page.ts
echo "// Copy the content for each file here" > src/pdf/toc.ts
echo "// Copy the content for each file here" > src/utils/logger.ts
echo -e "${GREEN}Added placeholders to files${NC}"

echo -e "${BLUE}===============================================${NC}"
echo -e "${GREEN}Project structure created successfully!${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "1. ${CYAN}cd xprinto${NC}"
echo -e "2. Copy the provided TypeScript code into the respective files"
echo -e "3. ${CYAN}npm run build${NC} to compile the TypeScript code"
echo -e "4. ${CYAN}npm link${NC} to use xprinto globally"
echo -e "5. ${CYAN}xprinto your/code/path -o output.pdf${NC} to generate a PDF"
echo ""
echo -e "${BLUE}Enjoy using xprinto!${NC}"