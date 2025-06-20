# Research Tools

This directory contains tools to assist with research, primarily by interacting with academic databases and APIs.

## arXiv Client

A command-line interface (CLI) tool to search and retrieve paper information from arXiv.org. This tool uses the public arXiv API directly and does not require any special installation beyond Python 3.

### Prerequisites

- Python 3

### Usage

The main script is `main.py`. It provides the following commands:

1.  **Search for papers:**
    ```bash
    python3 research_tools/main.py search "<query>" [--sort <sort_order>] [--max_results <number>]
    ```
    -   `<query>`: The search query for arXiv.
        -   Examples:
            -   `"all:electron"` (search all fields for "electron")
            -   `"ti:"quantum computing" AND au:Smith"` (search title for "quantum computing" AND author "Smith")
            -   `"cat:cs.LG"` (search for papers in the cs.LG category)
    -   `--sort <sort_order>`: Optional. Sort order for results. Choices: `relevance`, `lastUpdatedDate`, `submittedDate`. Default is `relevance`.
    -   `--max_results <number>`: Optional. Maximum number of results to return. Default is 10.

2.  **Get paper details by ID:**
    ```bash
    python3 research_tools/main.py get <arxiv_id>
    ```
    -   `<arxiv_id>`: The arXiv ID of the paper.
        -   Examples: `0706.0001`, `hep-ph/0307015`

### Example

```bash
# Search for the 5 most recent papers on "machine learning"
python3 research_tools/main.py search "all:"machine learning"" --sort lastUpdatedDate --max_results 5

# Get details for paper 2301.00001
python3 research_tools/main.py get 2301.00001
```

### Notes

-   The tool relies on the public arXiv API. Please be mindful of usage limits if performing many queries.
-   The parsing of arXiv's Atom XML feed is done using Python's standard libraries.
