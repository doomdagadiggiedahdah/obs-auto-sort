import { DatabaseManager } from '../database/queries';
import { SearchResult } from '../views/FleetingNotesView';

export interface ClusterPoint {
	id: string;
	title: string;
	x: number;
	y: number;
	cluster: number;
	color: string;
}

export interface TSNEResult {
	points: ClusterPoint[];
	clusters: number;
	perplexity: number;
	iterations: number;
}

export class Visualizer {
	private dbManager: DatabaseManager | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private currentData: TSNEResult | null = null;
	private selectedPoints: Set<string> = new Set();

	constructor(connectionString?: string) {
		if (connectionString) {
			this.dbManager = new DatabaseManager(connectionString);
		}
	}

	async initialize(connectionString: string): Promise<boolean> {
		try {
			this.dbManager = new DatabaseManager(connectionString);
			return await this.dbManager.testConnection();
		} catch (error) {
			console.error('Failed to initialize visualizer:', error);
			return false;
		}
	}

	setupCanvas(container: HTMLElement, width: number = 400, height: number = 300): HTMLCanvasElement {
		// Remove existing canvas if any
		const existingCanvas = container.querySelector('canvas');
		if (existingCanvas) {
			existingCanvas.remove();
		}

		this.canvas = container.createEl('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		this.canvas.style.border = '1px solid var(--background-modifier-border)';
		this.canvas.style.borderRadius = '4px';
		this.canvas.style.cursor = 'crosshair';

		this.ctx = this.canvas.getContext('2d');
		
		// Add event listeners for interaction
		this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
		this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));

		return this.canvas;
	}

	async generateTSNEVisualization(searchResults: SearchResult[], options: {
		perplexity?: number;
		iterations?: number;
		learningRate?: number;
	} = {}): Promise<TSNEResult> {
		if (!this.dbManager) {
			throw new Error('Database not initialized');
		}

		const {
			perplexity = 30,
			iterations = 1000,
			learningRate = 200
		} = options;

		// Get embeddings for the search results
		const embeddings: number[][] = [];
		const validResults: SearchResult[] = [];

		for (const result of searchResults) {
			try {
				const noteId = this.generateNoteId(result.file.path);
				const noteEmbeddings = await this.dbManager.getEmbeddingsByNoteId(noteId);
				
				if (noteEmbeddings.length > 0) {
					// Use the first embedding (or average multiple embeddings)
					const embedding = noteEmbeddings[0].embedding;
					if (embedding && Array.isArray(embedding)) {
						embeddings.push(embedding);
						validResults.push(result);
					}
				}
			} catch (error) {
				console.error(`Error getting embeddings for ${result.file.path}:`, error);
			}
		}

		if (embeddings.length < 2) {
			throw new Error('Not enough embeddings for visualization');
		}

		// Run t-SNE algorithm
		const tsneResult = await this.runTSNE(embeddings, {
			perplexity: Math.min(perplexity, Math.floor(embeddings.length / 3)),
			iterations,
			learningRate
		});

		// Assign clusters using simple k-means
		const clusters = this.assignClusters(tsneResult, Math.min(5, Math.floor(embeddings.length / 3)));

		// Create visualization points
		const points: ClusterPoint[] = validResults.map((result, index) => ({
			id: this.generateNoteId(result.file.path),
			title: result.title,
			x: tsneResult[index][0],
			y: tsneResult[index][1],
			cluster: clusters[index],
			color: this.getClusterColor(clusters[index])
		}));

		this.currentData = {
			points,
			clusters: Math.max(...clusters) + 1,
			perplexity,
			iterations
		};

		return this.currentData;
	}

	private async runTSNE(embeddings: number[][], options: {
		perplexity: number;
		iterations: number;
		learningRate: number;
	}): Promise<number[][]> {
		// Simplified t-SNE implementation
		// In a real implementation, you would use a proper t-SNE library
		const { perplexity, iterations, learningRate } = options;
		const n = embeddings.length;
		const dims = 2;

		// Initialize random positions
		const Y = Array.from({ length: n }, () => 
			Array.from({ length: dims }, () => (Math.random() - 0.5) * 0.0001)
		);

		// Compute pairwise distances in high-dimensional space
		const distances = this.computeDistances(embeddings);

		// Convert distances to probabilities
		const P = this.computeProbabilities(distances, perplexity);

		// Gradient descent
		const momentum = 0.8;
		const finalMomentum = 0.8;
		const etaMin = 50;
		let eta = learningRate;

		const gains = Array.from({ length: n }, () => Array(dims).fill(1));
		const uY = Array.from({ length: n }, () => Array(dims).fill(0));
		const dY = Array.from({ length: n }, () => Array(dims).fill(0));

		for (let iter = 0; iter < iterations; iter++) {
			// Compute Q (probabilities in low-dimensional space)
			const Q = this.computeLowDimProbabilities(Y);

			// Compute gradient
			this.computeGradient(P, Q, Y, dY);

			// Update Y using momentum
			for (let i = 0; i < n; i++) {
				for (let j = 0; j < dims; j++) {
					// Adaptive learning rate
					if (Math.sign(dY[i][j]) !== Math.sign(uY[i][j])) {
						gains[i][j] += 0.2;
					} else {
						gains[i][j] *= 0.8;
					}
					gains[i][j] = Math.max(gains[i][j], 0.01);

					// Update
					uY[i][j] = momentum * uY[i][j] - eta * gains[i][j] * dY[i][j];
					Y[i][j] += uY[i][j];
				}
			}

			// Center Y
			this.centerData(Y);

			// Reduce momentum after 250 iterations
			if (iter === 250) {
				eta = Math.max(eta / 4, etaMin);
			}
		}

		return Y;
	}

	private computeDistances(embeddings: number[][]): number[][] {
		const n = embeddings.length;
		const distances = Array.from({ length: n }, () => Array(n).fill(0));

		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				let dist = 0;
				for (let k = 0; k < embeddings[i].length; k++) {
					const diff = embeddings[i][k] - embeddings[j][k];
					dist += diff * diff;
				}
				distances[i][j] = distances[j][i] = Math.sqrt(dist);
			}
		}

		return distances;
	}

	private computeProbabilities(distances: number[][], perplexity: number): number[][] {
		const n = distances.length;
		const P = Array.from({ length: n }, () => Array(n).fill(0));
		const logPerp = Math.log(perplexity);

		for (let i = 0; i < n; i++) {
			// Binary search for appropriate sigma
			let beta = 1;
			let betaMin = 0;
			let betaMax = Infinity;

			for (let iter = 0; iter < 50; iter++) {
				let sum = 0;
				let H = 0;

				for (let j = 0; j < n; j++) {
					if (i !== j) {
						const prob = Math.exp(-beta * distances[i][j] * distances[i][j]);
						P[i][j] = prob;
						sum += prob;
						H += prob * distances[i][j] * distances[i][j];
					}
				}

				if (sum > 0) {
					H = (beta * H / sum) + Math.log(sum);
					
					const Hdiff = H - logPerp;
					if (Math.abs(Hdiff) < 1e-5) break;

					if (Hdiff > 0) {
						betaMin = beta;
						beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2;
					} else {
						betaMax = beta;
						beta = (beta + betaMin) / 2;
					}
				}
			}

			// Normalize
			let sum = 0;
			for (let j = 0; j < n; j++) {
				if (i !== j) sum += P[i][j];
			}
			if (sum > 0) {
				for (let j = 0; j < n; j++) {
					P[i][j] /= sum;
				}
			}
		}

		// Symmetrize
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				P[i][j] = (P[i][j] + P[j][i]) / (2 * n);
			}
		}

		return P;
	}

	private computeLowDimProbabilities(Y: number[][]): number[][] {
		const n = Y.length;
		const Q = Array.from({ length: n }, () => Array(n).fill(0));
		let sum = 0;

		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				let dist = 0;
				for (let k = 0; k < Y[i].length; k++) {
					const diff = Y[i][k] - Y[j][k];
					dist += diff * diff;
				}
				const qij = 1 / (1 + dist);
				Q[i][j] = Q[j][i] = qij;
				sum += 2 * qij;
			}
		}

		// Normalize
		if (sum > 0) {
			for (let i = 0; i < n; i++) {
				for (let j = 0; j < n; j++) {
					Q[i][j] = Math.max(Q[i][j] / sum, 1e-12);
				}
			}
		}

		return Q;
	}

	private computeGradient(P: number[][], Q: number[][], Y: number[][], dY: number[][]): void {
		const n = Y.length;
		const dims = Y[0].length;

		// Reset gradient
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < dims; j++) {
				dY[i][j] = 0;
			}
		}

		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				if (i !== j) {
					const mult = (P[i][j] - Q[i][j]);
					let dist = 0;
					for (let k = 0; k < dims; k++) {
						const diff = Y[i][k] - Y[j][k];
						dist += diff * diff;
					}
					const factor = mult / (1 + dist);

					for (let k = 0; k < dims; k++) {
						dY[i][k] += factor * (Y[i][k] - Y[j][k]);
					}
				}
			}
		}
	}

	private centerData(Y: number[][]): void {
		const n = Y.length;
		const dims = Y[0].length;

		for (let j = 0; j < dims; j++) {
			let mean = 0;
			for (let i = 0; i < n; i++) {
				mean += Y[i][j];
			}
			mean /= n;

			for (let i = 0; i < n; i++) {
				Y[i][j] -= mean;
			}
		}
	}

	private assignClusters(points: number[][], numClusters: number): number[] {
		if (numClusters <= 1) return points.map(() => 0);

		const n = points.length;
		const dims = points[0].length;
		const clusters = Array(n).fill(0);

		// K-means clustering
		const centroids = Array.from({ length: numClusters }, () => 
			Array.from({ length: dims }, () => Math.random() * 2 - 1)
		);

		for (let iter = 0; iter < 50; iter++) {
			// Assign points to clusters
			for (let i = 0; i < n; i++) {
				let minDist = Infinity;
				let bestCluster = 0;

				for (let c = 0; c < numClusters; c++) {
					let dist = 0;
					for (let d = 0; d < dims; d++) {
						const diff = points[i][d] - centroids[c][d];
						dist += diff * diff;
					}
					if (dist < minDist) {
						minDist = dist;
						bestCluster = c;
					}
				}
				clusters[i] = bestCluster;
			}

			// Update centroids
			const counts = Array(numClusters).fill(0);
			const newCentroids = Array.from({ length: numClusters }, () => Array(dims).fill(0));

			for (let i = 0; i < n; i++) {
				const c = clusters[i];
				counts[c]++;
				for (let d = 0; d < dims; d++) {
					newCentroids[c][d] += points[i][d];
				}
			}

			for (let c = 0; c < numClusters; c++) {
				if (counts[c] > 0) {
					for (let d = 0; d < dims; d++) {
						centroids[c][d] = newCentroids[c][d] / counts[c];
					}
				}
			}
		}

		return clusters;
	}

	private getClusterColor(cluster: number): string {
		const colors = [
			'#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
			'#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
			'#FD79A8', '#A29BFE', '#6C5CE7', '#74B9FF', '#81ECEC'
		];
		return colors[cluster % colors.length];
	}

	renderVisualization(): void {
		if (!this.canvas || !this.ctx || !this.currentData) return;

		const { width, height } = this.canvas;
		const { points } = this.currentData;

		// Clear canvas
		this.ctx.clearRect(0, 0, width, height);

		// Find bounds
		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;

		for (const point of points) {
			minX = Math.min(minX, point.x);
			maxX = Math.max(maxX, point.x);
			minY = Math.min(minY, point.y);
			maxY = Math.max(maxY, point.y);
		}

		const padding = 20;
		const scaleX = (width - 2 * padding) / (maxX - minX);
		const scaleY = (height - 2 * padding) / (maxY - minY);

		// Draw points
		for (const point of points) {
			const x = padding + (point.x - minX) * scaleX;
			const y = padding + (point.y - minY) * scaleY;

			this.ctx.beginPath();
			this.ctx.arc(x, y, this.selectedPoints.has(point.id) ? 8 : 5, 0, 2 * Math.PI);
			this.ctx.fillStyle = point.color;
			this.ctx.fill();
			
			if (this.selectedPoints.has(point.id)) {
				this.ctx.strokeStyle = '#000000';
				this.ctx.lineWidth = 2;
				this.ctx.stroke();
			}
		}
	}

	private handleCanvasClick(event: MouseEvent): void {
		if (!this.canvas || !this.currentData) return;

		const rect = this.canvas.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const clickY = event.clientY - rect.top;

		const clickedPoint = this.getPointAtPosition(clickX, clickY);
		if (clickedPoint) {
			if (this.selectedPoints.has(clickedPoint.id)) {
				this.selectedPoints.delete(clickedPoint.id);
			} else {
				this.selectedPoints.add(clickedPoint.id);
			}
			this.renderVisualization();
		}
	}

	private handleCanvasHover(event: MouseEvent): void {
		if (!this.canvas || !this.currentData) return;

		const rect = this.canvas.getBoundingClientRect();
		const hoverX = event.clientX - rect.left;
		const hoverY = event.clientY - rect.top;

		const hoveredPoint = this.getPointAtPosition(hoverX, hoverY);
		this.canvas.title = hoveredPoint ? hoveredPoint.title : '';
	}

	private getPointAtPosition(x: number, y: number): ClusterPoint | null {
		if (!this.currentData) return null;

		const { points } = this.currentData;
		const { width, height } = this.canvas!;

		// Find bounds
		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;

		for (const point of points) {
			minX = Math.min(minX, point.x);
			maxX = Math.max(maxX, point.x);
			minY = Math.min(minY, point.y);
			maxY = Math.max(maxY, point.y);
		}

		const padding = 20;
		const scaleX = (width - 2 * padding) / (maxX - minX);
		const scaleY = (height - 2 * padding) / (maxY - minY);

		for (const point of points) {
			const pointX = padding + (point.x - minX) * scaleX;
			const pointY = padding + (point.y - minY) * scaleY;

			const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
			if (distance <= 8) { // Click radius
				return point;
			}
		}

		return null;
	}

	getSelectedPoints(): ClusterPoint[] {
		if (!this.currentData) return [];
		return this.currentData.points.filter(p => this.selectedPoints.has(p.id));
	}

	clearSelection(): void {
		this.selectedPoints.clear();
		this.renderVisualization();
	}

	private generateNoteId(path: string): string {
		return btoa(path).replace(/[^a-zA-Z0-9]/g, '');
	}

	async close(): Promise<void> {
		if (this.dbManager) {
			await this.dbManager.close();
		}
	}
}