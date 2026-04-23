(function (window, document) {
    if (window.axiomate && window.axiomate.initialized) return;

    const AXIOMATE_URL = "/api/v1/ingest/";
    const STORAGE_KEY = "axiomate_anonymous_id";
    const SESSION_KEY = "axiomate_session_id";

    // Lightweight UUID generator 
    function uuidv4() {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    // Identity Management
    let anonymousId = localStorage.getItem(STORAGE_KEY);
    if (!anonymousId) {
        anonymousId = uuidv4();
        localStorage.setItem(STORAGE_KEY, anonymousId);
    }

    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = uuidv4();
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    // Capture the pre-initialization queue if the user used the async snippet
    const preInitQueue = window.axiomate || [];

    // Main SDK Object
    const sdk = {
        initialized: true,
        apiKey: null,
        queue: [],
        flushTimer: null,

        init: function (apiKey) {
            this.apiKey = apiKey;
            this.track("page_view"); // Automatically track the first page load
            this.scheduleFlush(); // Flush immediately on init
        },

        track: function (eventName, properties = {}, context = {}) {
            if (!this.apiKey && this.initialized) {
                // Ignore tracking calls if init hasn't happened yet (shouldn't happen with proper queueing)
                // We'll queue it anyway in case init is called late.
            }

            const event = {
                event_id: uuidv4(),
                event_name: eventName,
                anonymous_id: anonymousId,
                session_id: sessionId,
                occurred_at: new Date().toISOString(),
                properties: properties,
                context: Object.assign({
                    url: window.location.href,
                    user_agent: navigator.userAgent,
                    screen_width: window.innerWidth,
                    title: document.title
                }, context)
            };

            this.queue.push(event);
            this.scheduleFlush();
        },

        scheduleFlush: function () {
            if (this.flushTimer) return;
            this.flushTimer = setTimeout(() => this.flush(), 1000); // Flush queue every 1s
        },

        flush: function () {
            this.flushTimer = null;
            if (this.queue.length === 0 || !this.apiKey) return;

            const batch = this.queue.splice(0, 500); // 500 is max batch size

            fetch(AXIOMATE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": this.apiKey
                },
                body: JSON.stringify({ events: batch }),
                keepalive: true // Ensure requests complete even if user is navigating away
            }).catch(err => {
                console.error("Axiomate: Failed to send events", err);
                this.queue.unshift(...batch); // Requeue on failure
            });
        },
        // push() allows the async snippet pattern to work even after the SDK has loaded.
        // e.g. window.axiomate.push(["track", "event", {...}]) always works.
        push: function (args) {
            if (!Array.isArray(args)) return;
            const method = args[0];
            if (typeof this[method] === "function") {
                this[method].apply(this, args.slice(1));
            }
        }
    };

    // Override the global object
    window.axiomate = sdk;

    // Process the backlog of commands that were issued before the script downloaded
    if (Array.isArray(preInitQueue)) {
        while (preInitQueue.length > 0) {
            const args = preInitQueue.shift();
            // args is like: ["init", "MY_API_KEY"] or ["track", "Clicked Button"]
            const method = args[0];
            if (typeof sdk[method] === "function") {
                sdk[method].apply(sdk, args.slice(1));
            }
        }
    }

})(window, document);
