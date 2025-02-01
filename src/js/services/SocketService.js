export class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    connect(url = 'http://localhost:3000') {
        if (this.socket) {
            this.disconnect();
        }
        this.socket = io(url);
        return this;
    }

    disconnect() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(event, callback) {
        if (!this.socket) return;
        this.socket.on(event, callback);
        this.listeners.set(event, callback);
    }

    emit(event, ...args) {
        if (!this.socket) return;
        this.socket.emit(event, ...args);
    }

    removeAllListeners() {
        if (!this.socket) return;
        this.listeners.forEach((callback, event) => {
            this.socket.off(event, callback);
        });
        this.listeners.clear();
    }

    getSocket() {
        return this.socket;
    }
}

// Create a singleton instance
const socketService = new SocketService();
export default socketService; 