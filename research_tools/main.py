#!/usr/bin/env python3

import argparse
from arxiv_http_client import search_papers, get_paper_details

def main():
    parser = argparse.ArgumentParser(description="CLI tool to interact with the arXiv API.")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    subparsers.required = True

    # arXiv search command
    parser_search_arxiv = subparsers.add_parser('search', help='Search arXiv for papers')
    parser_search_arxiv.add_argument('query', type=str, help='Search query (e.g., "all:electron" or "ti:gravity AND au:Einstein")')
    parser_search_arxiv.add_argument('--sort', type=str, default='relevance', choices=['relevance', 'lastUpdatedDate', 'submittedDate'], help='Sort order for results')
    parser_search_arxiv.add_argument('--max_results', type=int, default=10, help='Maximum number of results to return')

    # arXiv get paper details command
    parser_get_arxiv = subparsers.add_parser('get', help='Get details for a specific arXiv paper by ID')
    parser_get_arxiv.add_argument('arxiv_id', type=str, help='arXiv ID (e.g., "0706.0001" or "hep-ph/0307015")')

    args = parser.parse_args()

    if args.command == 'search':
        print(f"Searching arXiv for: '{args.query}', sort_by: {args.sort}, max_results: {args.max_results}")
        papers = search_papers(query=args.query, sort_by=args.sort, max_results=args.max_results)
        if papers:
            print(f"Found {len(papers)} paper(s):")
            for i, paper in enumerate(papers):
                print(f"--- Result {i+1} ---")
                print(f"  ID: {paper.get('arxiv_id', 'N/A')}")
                print(f"  Title: {paper.get('title', 'N/A')}")
                print(f"  Authors: {', '.join(paper.get('authors', []))}")
                print(f"  Published: {paper.get('published_date', 'N/A')}")
                print(f"  PDF: {paper.get('pdf_url', 'N/A')}")
                summary = paper.get('summary', 'N/A')
                print(f"  Summary: {summary[:200]}..." if len(summary) > 200 else summary)
        else:
            print("No papers found or an error occurred during the search.")

    elif args.command == 'get':
        print(f"Fetching details for arXiv ID: {args.arxiv_id}")
        paper = get_paper_details(arxiv_id=args.arxiv_id)
        if paper:
            print("--- Paper Details ---")
            print(f"  ID: {paper.get('arxiv_id', 'N/A')}")
            print(f"  Title: {paper.get('title', 'N/A')}")
            print(f"  Authors: {', '.join(paper.get('authors', []))}")
            print(f"  Published: {paper.get('published_date', 'N/A')}")
            print(f"  PDF: {paper.get('pdf_url', 'N/A')}")
            summary = paper.get('summary', 'N/A')
            print(f"  Summary: {summary}")
        else:
            print(f"Could not retrieve details for arXiv ID '{args.arxiv_id}', or the ID is invalid.")

if __name__ == '__main__':
    main()
