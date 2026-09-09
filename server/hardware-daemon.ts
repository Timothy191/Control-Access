import net from "net";
import dgram from "dgram";

const TCP_PORT_START = 8081;
const TCP_PORT_END = 8200;
const UDP_PORT_START = 5000;
const UDP_PORT_END = 10000;

export function startHardwareDaemon() {
  console.log(`Starting Hardware Daemon...`);
  
  // Example single TCP server
  const tcpServer = net.createServer((socket) => {
    socket.on("data", (data) => {
      console.log("TCP Data received:", data.toString());
      // Handle keep-alive payload
      if (data.toString().includes("PING")) {
        socket.write("PONG\n");
      }
    });
  });

  tcpServer.listen(TCP_PORT_START, () => {
    console.log(`TCP Server listening on port ${TCP_PORT_START}`);
  });

  // Example single UDP server
  const udpServer = dgram.createSocket("udp4");
  
  udpServer.on("message", (msg, rinfo) => {
    console.log(`UDP Server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  });

  udpServer.on("listening", () => {
    const address = udpServer.address();
    console.log(`UDP Server listening on ${address.address}:${address.port}`);
  });

  udpServer.bind(UDP_PORT_START);

  return { tcpServer, udpServer };
}

// In a real production setup, this file would be run via a custom server.js
// or a separate process.
if (require.main === module) {
  startHardwareDaemon();
}
