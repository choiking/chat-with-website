const { extractContent } = require('./contentExtractor');

describe('Content Extractor', () => {
  test('extracts text content from a simple HTML string', () => {
    const htmlString = '<div><p>Hello, world!</p></div>';
    const expectedContent = 'Hello, world!';
    
    expect(extractContent(htmlString)).toBe(expectedContent);
  });

  test('handles empty input', () => {
    expect(extractContent('')).toBe('');
  });

  test('extracts content from complex HTML structure', () => {
    const complexHtml = `
      <div>
        <h1>Title</h1>
        <p>Paragraph 1</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    `;
    const expectedContent = 'Title Paragraph 1 Item 1 Item 2';
    
    expect(extractContent(complexHtml).replace(/\s+/g, ' ').trim()).toBe(expectedContent);
  });

  // Add more tests as needed
});