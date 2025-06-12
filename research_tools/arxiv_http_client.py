#!/usr/bin/env python3

import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

ATOM_NAMESPACE = '{http://www.w3.org/2005/Atom}'
ARXIV_NAMESPACE = '{http://arxiv.org/schemas/atom}'

def _parse_entry(entry):
    try:
        arxiv_id_full = entry.find(f"{ATOM_NAMESPACE}id").text
        arxiv_id = arxiv_id_full.split("/")[-1]
        title = entry.find(f"{ATOM_NAMESPACE}title").text.strip().replace("\n"," ")
        summary = entry.find(f"{ATOM_NAMESPACE}summary").text.strip().replace("\n"," ")
        published_date = entry.find(f"{ATOM_NAMESPACE}published").text
        authors = [author.find(f"{ATOM_NAMESPACE}name").text for author in entry.findall(f"{ATOM_NAMESPACE}author") if author.find(f"{ATOM_NAMESPACE}name") is not None]
        pdf_url = ""
        for link in entry.findall(f"{ATOM_NAMESPACE}link"):
            if link.get("title") == "pdf":
                pdf_url = link.get("href")
                break
        return {
            "arxiv_id": arxiv_id,
            "title": title,
            "authors": authors,
            "summary": summary,
            "published_date": published_date,
            "pdf_url": pdf_url
        }
    except Exception as e:
        # print(f"Error parsing entry: {e}") # Simplified error handling
        return None

def search_papers(query: str, sort_by: str = "relevance", max_results: int = 10):
    base_url = "http://export.arxiv.org/api/query?"
    params = {
        "search_query": query,
        "sortBy": sort_by,
        "start": "0",
        "max_results": str(max_results)
    }
    encoded_params = urllib.parse.urlencode(params)
    full_url = base_url + encoded_params
    try:
        with urllib.request.urlopen(full_url) as response:
            xml_data = response.read().decode("utf-8")
        root = ET.fromstring(xml_data)
        results = []
        for entry in root.findall(f".//{ATOM_NAMESPACE}entry"):
            parsed = _parse_entry(entry)
            if parsed: results.append(parsed)
        return results
    except Exception as e:
        # print(f"Error in search_papers: {e}") # Simplified
        return []

def get_paper_details(arxiv_id: str):
    base_url = "http://export.arxiv.org/api/query?"
    params = {"id_list": arxiv_id}
    encoded_params = urllib.parse.urlencode(params)
    full_url = base_url + encoded_params
    try:
        with urllib.request.urlopen(full_url) as response:
            xml_data = response.read().decode("utf-8")
        root = ET.fromstring(xml_data)
        entry = root.find(f".//{ATOM_NAMESPACE}entry")
        if entry is not None: return _parse_entry(entry)
        else: return None
    except Exception as e:
        # print(f"Error in get_paper_details: {e}") # Simplified
        return None

if __name__ == '__main__':
    print('Testing arXiv HTTP client...')
    test_papers = search_papers('all:electron', max_results=1)
    if test_papers:
        print(f'Found paper: {test_papers[0]["title"]}')
    else:
        print('Search test failed or no papers found.')
    test_detail = get_paper_details('hep-ex/0307015')
    if test_detail:
        print(f'Found detail: {test_detail["title"]}')
    else:
        print('Detail test failed or paper not found.')
