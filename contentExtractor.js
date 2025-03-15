function extractContent() {
  // Helper function to get text content without hidden elements
  function getVisibleText(element) {
    return Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && window.getComputedStyle(node).display !== 'none'))
      .map(node => node.textContent)
      .join(' ')
      .trim();
  }

  // Extract main content
  function extractMainContent() {
    const contentSelectors = ['article', 'main', '.main-content', '#content', '.post-content'];
    for (let selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return getVisibleText(element);
      }
    }
    return getVisibleText(document.body);
  }

  // Extract headings
  function extractHeadings() {
    return ['h1', 'h2', 'h3'].map(tag => {
      return Array.from(document.getElementsByTagName(tag))
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0);
    });
  }

  // Extract links
  function extractImportantLinks() {
    return Array.from(document.getElementsByTagName('a'))
      .filter(a => a.textContent.trim().length > 0 && a.href.startsWith('http'))
      .map(a => ({text: a.textContent.trim(), href: a.href}))
      .slice(0, 5);  // Limit to 5 links
  }

  const [h1s, h2s, h3s] = extractHeadings();

  return {
    url: window.location.href,
    title: document.title,
    metaDescription: document.querySelector('meta[name="description"]')?.content || '',
    h1: h1s.length > 0 ? h1s[0] : '',
    headings: {h1s, h2s, h3s},
    mainContent: extractMainContent().substring(0, 3000),  // Limit to 3000 characters
    importantLinks: extractImportantLinks()
  };
}

extractContent();
