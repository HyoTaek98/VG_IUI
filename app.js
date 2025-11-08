// Global state
let currentData = null;
let activeGuidelines = new Set(['size', 'color', 'crossings', 'clustering']);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeUpload();
    initializeGuidelines();
    initializeChat();
    initializeDownload();
    loadSampleData();
});

// Download functionality
function initializeDownload() {
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.addEventListener('click', () => {
        addMessage('agent', '📦 Download these 3 files to run the application:\n• index.html\n• styles.css\n• app.js\n\nMake sure all files are in the same folder!', 'System');
    });
}

// File Upload
function initializeUpload() {
    const uploadBox = document.getElementById('uploadBox');
    const fileInput = document.getElementById('fileInput');

    uploadBox.addEventListener('click', () => fileInput.click());
    
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFile(file);
    });
}

function handleFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        let data;

        try {
            if (file.name.endsWith('.json')) {
                data = JSON.parse(content);
            } else if (file.name.endsWith('.csv')) {
                data = parseCSV(content);
            }

            currentData = data;
            displayDataPreview(data);
            updateDatasetInfo(file.name, data);
            renderVisualizations();
            addMessage('user', `Uploaded ${file.name}`);
            simulateAgentResponse();
        } catch (error) {
            addMessage('agent', `Error parsing file: ${error.message}`, 'System');
        }
    };

    reader.readAsText(file);
}

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const nodes = new Set();
    const links = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const source = values[0];
        const target = values[1];
        nodes.add(source);
        nodes.add(target);
        links.push({ source, target });
    }

    return {
        nodes: Array.from(nodes).map(id => ({ id })),
        links
    };
}

function displayDataPreview(data) {
    const preview = document.getElementById('datasetPreview');
    const header = document.getElementById('previewHeader');
    const thead = document.getElementById('previewTableHead');
    const tbody = document.getElementById('previewTableBody');

    preview.style.display = 'block';
    header.textContent = `Dataset Preview - ${data.nodes.length} nodes, ${data.links.length} edges`;

    thead.innerHTML = '<tr><th>FromNodeId</th><th>ToNodeId</th></tr>';
    tbody.innerHTML = '';

    const displayLinks = data.links.slice(0, 5);
    displayLinks.forEach(link => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${link.source.id || link.source}</td><td>${link.target.id || link.target}</td>`;
        tbody.appendChild(row);
    });
}

function updateDatasetInfo(filename, data) {
    const info = document.getElementById('dataset-info');
    info.textContent = `Dataset: ${filename} (${data.nodes.length} nodes, ${data.links.length} edges)`;
}

// Guidelines
function initializeGuidelines() {
    const items = document.querySelectorAll('.guideline-item');
    items.forEach(item => {
        const checkbox = item.querySelector('.guideline-checkbox');
        const guideline = item.dataset.guideline;

        item.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                activeGuidelines.add(guideline);
                item.classList.add('active');
            } else {
                activeGuidelines.delete(guideline);
                item.classList.remove('active');
            }
            if (currentData) {
                renderVisualizations();
            }
        });

        if (checkbox.checked) {
            item.classList.add('active');
        }
    });
}

// Visualization
function renderVisualizations() {
    if (!currentData) return;

    renderGraph('viz-without', currentData, false);
    renderGraph('viz-with', currentData, true);
}

function renderGraph(containerId, data, withGuidelines) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(`#${containerId}`)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const graphData = JSON.parse(JSON.stringify(data));

    // Calculate node degrees
    const degrees = new Map();
    graphData.nodes.forEach(node => degrees.set(node.id, 0));
    graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        degrees.set(sourceId, (degrees.get(sourceId) || 0) + 1);
        degrees.set(targetId, (degrees.get(targetId) || 0) + 1);
    });

    const simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(50))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(20));

    const link = svg.append('g')
        .selectAll('line')
        .data(graphData.links)
        .join('line')
        .attr('class', 'link')
        .attr('stroke-width', 1);

    const node = svg.append('g')
        .selectAll('circle')
        .data(graphData.nodes)
        .join('circle')
        .attr('class', 'node')
        .attr('r', d => {
            if (withGuidelines && activeGuidelines.has('size')) {
                const degree = degrees.get(d.id) || 0;
                return 5 + degree * 0.5;
            }
            return 5;
        })
        .attr('fill', (d, i) => {
            if (withGuidelines && activeGuidelines.has('color')) {
                const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140'];
                return colors[i % colors.length];
            }
            return '#999';
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .call(drag(simulation));

    node.append('title').text(d => `Node: ${d.id}\nDegree: ${degrees.get(d.id) || 0}`);

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });
}

function drag(simulation) {
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

// Chat
function initializeChat() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    addMessage('user', message);
    input.value = '';

    setTimeout(() => simulateAgentResponse(), 1000);
}

function addMessage(type, content, agent = 'You') {
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    const avatarClass = type === 'user' ? 'user-avatar' : 'agent-avatar';
    const avatarText = type === 'user' ? 'You' : (agent === 'GA' ? 'GA' : agent === 'VA' ? 'VA' : 'SYS');

    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar ${avatarClass}">${avatarText}</div>
            <div class="message-name">${agent}</div>
        </div>
        <div class="message-content">${content}</div>
    `;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function addAgentStatus(agent, status) {
    const container = document.getElementById('chatMessages');
    const lastMessage = container.lastElementChild;
    const statusDiv = document.createElement('div');
    statusDiv.className = 'agent-status';
    statusDiv.textContent = status;
    lastMessage.appendChild(statusDiv);
    container.scrollTop = container.scrollHeight;
}

function simulateAgentResponse() {
    addMessage('agent', 'Analyzing your request and searching for relevant guidelines...', 'Guideline Agent');
    
    setTimeout(() => {
        addAgentStatus('GA', 'Checking your instruction');
    }, 500);

    setTimeout(() => {
        addAgentStatus('GA', 'Searching for relevant guidelines');
    }, 1000);

    setTimeout(() => {
        addAgentStatus('GA', 'Passing the guidelines');
    }, 1500);

    setTimeout(() => {
        addMessage('agent', 'I have visualized your network. The visualization shows the structure with applied guidelines for better clarity.', 'Visualization Agent');
    }, 2000);

    setTimeout(() => {
        addAgentStatus('VA', 'Checking the guidelines');
    }, 2500);

    setTimeout(() => {
        addAgentStatus('VA', 'Generating the code');
    }, 3000);

    setTimeout(() => {
        addAgentStatus('VA', 'Rendering');
    }, 3500);
}

// Load sample data
function loadSampleData() {
    const sampleData = {
        nodes: Array.from({length: 30}, (_, i) => ({id: `${i}`})),
        links: []
    };

    // Create a small-world network structure
    for (let i = 0; i < 30; i++) {
        // Local connections
        sampleData.links.push({
            source: `${i}`,
            target: `${(i + 1) % 30}`
        });
        
        // Some random long-range connections
        if (Math.random() > 0.7) {
            const target = Math.floor(Math.random() * 30);
            if (target !== i) {
                sampleData.links.push({
                    source: `${i}`,
                    target: `${target}`
                });
            }
        }
    }

    currentData = sampleData;
    displayDataPreview(sampleData);
    updateDatasetInfo('Sample Small-World Network', sampleData);
    renderVisualizations();
}