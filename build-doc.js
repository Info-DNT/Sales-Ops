const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, 'PROJECT_DOCUMENTATION.md');
const htmlPath = path.join(__dirname, 'PROJECT_DOCUMENTATION.html');

if (!fs.existsSync(mdPath)) {
    console.error('PROJECT_DOCUMENTATION.md not found!');
    process.exit(1);
}

const mdContent = fs.readFileSync(mdPath, 'utf8');

// HTML template with premium design, dynamic marked.js parser, and print layout optimization
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Air Medical 24x7 - System Documentation & Pitch Deck</title>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Font Awesome -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <!-- Markdown Parser -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <!-- Mermaid Diagrams -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        :root {
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --secondary: #0f172a;
            --accent: #8b5cf6;
            --bg-light: #f8fafc;
            --border: #e2e8f0;
            --text-main: #334155;
            --text-heading: #0f172a;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            color: var(--text-main);
            background-color: var(--bg-light);
            line-height: 1.7;
            margin: 0;
            padding: 0;
        }

        header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 4rem 2rem;
            text-align: center;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(79, 70, 229, 0.2);
        }

        header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px);
            background-size: 30px 30px;
        }

        header h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 2.8rem;
            font-weight: 700;
            margin: 0 0 1rem 0;
            letter-spacing: -0.03em;
        }

        header p {
            font-size: 1.25rem;
            font-weight: 300;
            max-width: 800px;
            margin: 0 auto;
            opacity: 0.9;
        }

        .container {
            max-width: 900px;
            margin: -3rem auto 4rem auto;
            background: white;
            border-radius: 24px;
            padding: 4rem;
            box-shadow: 0 20px 40px rgba(15, 23, 42, 0.05);
            position: relative;
            z-index: 10;
            border: 1px solid var(--border);
        }

        /* Markdown Styling */
        #content {
            font-size: 1.1rem;
        }

        h1, h2, h3, h4 {
            font-family: 'Outfit', sans-serif;
            color: var(--text-heading);
            font-weight: 700;
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            letter-spacing: -0.02em;
        }

        #content > h1 {
            font-size: 2rem;
            border-bottom: 2px solid var(--border);
            padding-bottom: 0.5rem;
            margin-top: 3rem;
        }

        h2 {
            font-size: 1.6rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.5rem;
        }

        h3 {
            font-size: 1.3rem;
        }

        p {
            margin-bottom: 1.5rem;
        }

        a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
        }

        a:hover {
            text-decoration: underline;
        }

        ul, ol {
            margin-bottom: 1.5rem;
            padding-left: 2rem;
        }

        li {
            margin-bottom: 0.5rem;
        }

        code {
            font-family: 'Courier New', Courier, monospace;
            background-color: #f1f5f9;
            color: #0f172a;
            padding: 0.2rem 0.4rem;
            border-radius: 6px;
            font-size: 0.9em;
            border: 1px solid #e2e8f0;
        }

        pre {
            background-color: #0f172a;
            color: #f8fafc;
            padding: 1.5rem;
            border-radius: 12px;
            overflow-x: auto;
            margin-bottom: 1.5rem;
        }

        pre code {
            background-color: transparent;
            color: inherit;
            padding: 0;
            border: none;
            border-radius: 0;
            font-size: 0.95em;
        }

        blockquote {
            border-left: 4px solid var(--primary);
            background-color: #f0fdf4;
            padding: 1rem 1.5rem;
            margin: 1.5rem 0;
            border-radius: 0 12px 12px 0;
            color: #15803d;
        }

        /* Premium Table Design */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2rem;
            margin-top: 1rem;
            font-size: 0.95rem;
        }

        th, td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }

        th {
            background-color: #f8fafc;
            color: var(--text-heading);
            font-weight: 600;
        }

        tr:hover {
            background-color: #f8fafc;
        }

        hr {
            border: 0;
            height: 1px;
            background: var(--border);
            margin: 3rem 0;
        }

        .btn-print {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            border: none;
            border-radius: 50px;
            padding: 1rem 2rem;
            font-family: 'Outfit', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(79, 70, 229, 0.3);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 100;
            transition: all 0.3s ease;
        }

        .btn-print:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 30px rgba(79, 70, 229, 0.4);
        }

        /* Print media styles */
        @media print {
            body {
                background-color: white;
                color: black;
            }
            .container {
                box-shadow: none;
                border: none;
                margin: 0;
                padding: 0;
                max-width: 100%;
            }
            header {
                display: none;
            }
            .btn-print {
                display: none;
            }
        }
    </style>
</head>
<body>

    <header>
        <h1>Air Medical 24x7</h1>
        <p>Sales Operations Management System — Pitch Deck & Technical Documentation</p>
    </header>

    <div class="container">
        <div id="content"></div>
    </div>

    <button class="btn-print" onclick="window.print()">
        <i class="fas fa-file-pdf"></i> Save / Print PDF
    </button>

    <script>
        // Set raw Markdown
        const rawMarkdown = \`${mdContent.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`;
        
        // Parse and render
        document.getElementById('content').innerHTML = marked.parse(rawMarkdown);

        // Initialize Mermaid
        mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
    </script>
</body>
</html>`;

fs.writeFileSync(htmlPath, htmlTemplate, 'utf8');
console.log('Successfully generated PROJECT_DOCUMENTATION.html!');
