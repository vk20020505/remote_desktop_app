# import socket
# import sys
# from pynput.mouse import Button, Controller

# # Initialize mouse controller
# mouse = Controller()

# # Server configuration
# HOST = '0.0.0.0'  # Listen on all available interfaces
# PORT = 12345      # Port to listen on (choose any free port above 1024)

# print(f"Starting server on {HOST}:{PORT}")
# print("Make sure your firewall allows connections on this port.")
# print("To find your laptop's local IP, open a terminal/command prompt and type 'ipconfig' (Windows) or 'ifconfig' / 'ip a' (macOS/Linux).")
# print("Look for the IPv4 address associated with your Wi-Fi adapter (e.g., 192.168.1.X or 10.0.0.X)")

# with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
#     s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) # Allows reusing the address quickly
#     s.bind((HOST, PORT))
#     s.listen(1) # Listen for up to 1 connection
#     print("Waiting for a connection...")
#     conn, addr = s.accept()
#     with conn:
#         print(f"Connected by {addr}")
#         while True:
#             try:
#                 data = conn.recv(1024).decode('utf-8').strip()
#                 if not data:
#                     print("Client disconnected.")
#                     break

#                 # Simple command parsing (e.g., "MOVE 5 -3", "CLICK_LEFT", "CLICK_RIGHT")
#                 parts = data.split()
#                 command = parts[0]

#                 if command == "MOVE":
#                     if len(parts) == 3:
#                         try:
#                             dx = int(parts[1])
#                             dy = int(parts[2])
#                             mouse.move(dx, dy)
#                             # print(f"Moved mouse by ({dx}, {dy})") # Uncomment for debugging
#                         except ValueError:
#                             print(f"Invalid MOVE data: {data}")
#                     else:
#                         print(f"Invalid MOVE command format: {data}")
#                 elif command == "CLICK_LEFT":
#                     mouse.press(Button.left)
#                     mouse.release(Button.left)
#                     # print("Left click") # Uncomment for debugging
#                 elif command == "CLICK_RIGHT":
#                     mouse.press(Button.right)
#                     mouse.release(Button.right)
#                     # print("Right click") # Uncomment for debugging
#                 elif command == "SCROLL":
#                      if len(parts) == 2:
#                         try:
#                             dy = int(parts[1]) # Scroll up/down
#                             mouse.scroll(0, dy)
#                             # print(f"Scrolled by {dy}") # Uncomment for debugging
#                         except ValueError:
#                             print(f"Invalid SCROLL data: {data}")
#                      else:
#                         print(f"Invalid SCROLL command format: {data}")
#                 else:
#                     print(f"Unknown command: {data}")

#             except ConnectionResetError:
#                 print("Client forcibly disconnected.")
#                 break
#             except Exception as e:
#                 print(f"An error occurred: {e}")
#                 break

# print("Server stopped.")




# import socket
# import sys
# from pynput.mouse import Button, Controller as MouseController
# from pynput.keyboard import Key, Controller as KeyboardController

# # Initialize controllers
# mouse = MouseController()
# keyboard = KeyboardController()

# # Server configuration
# HOST = '0.0.0.0'  # Listen on all available interfaces
# PORT = 12345      # Port to listen on (choose any free port above 1024)

# print(f"Starting server on {HOST}:{PORT}")
# print("Make sure your firewall allows connections on this port.")
# print("To find your laptop's local IP, open a terminal/command prompt and type 'ipconfig' (Windows) or 'ifconfig' / 'ip a' (macOS/Linux).")
# print("Look for the IPv4 address associated with your Wi-Fi adapter (e.g., 192.168.1.X or 10.0.0.X)")

# with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
#     s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) # Allows reusing the address quickly
#     s.bind((HOST, PORT))
#     s.listen(1) # Listen for up to 1 connection
#     print("Waiting for a connection...")
#     conn, addr = s.accept()
#     with conn:
#         print(f"Connected by {addr}")
#         while True:
#             try:
#                 data = conn.recv(1024).decode('utf-8').strip()
#                 if not data:
#                     print("Client disconnected.")
#                     break

#                 # Command parsing
#                 parts = data.split()
#                 command = parts[0]

#                 if command == "MOVE":
#                     if len(parts) == 3:
#                         try:
#                             dx = int(parts[1])
#                             dy = int(parts[2])
#                             mouse.move(dx, dy)
#                         except ValueError:
#                             print(f"Invalid MOVE data: {data}")
#                     else:
#                         print(f"Invalid MOVE command format: {data}")

#                 elif command == "CLICK_LEFT":
#                     mouse.click(Button.left)

#                 elif command == "CLICK_RIGHT":
#                     mouse.click(Button.right)

#                 elif command == "SCROLL":
#                     if len(parts) == 2:
#                         try:
#                             dy = int(parts[1])
#                             mouse.scroll(0, dy * 3)
#                         except ValueError:
#                             print(f"Invalid SCROLL data: {data}")
#                     else:
#                         print(f"Invalid SCROLL command format: {data}")

#                 # ✅ New commands for macOS Desktop Switching
#                 elif command == "DESKTOP_LEFT":
#                     with keyboard.pressed(Key.ctrl):
#                         keyboard.press(Key.left)
#                         keyboard.release(Key.left)

#                 elif command == "DESKTOP_RIGHT":
#                     with keyboard.pressed(Key.ctrl):
#                         keyboard.press(Key.right)
#                         keyboard.release(Key.right)

#                 # ✅ Extra: App switching (Cmd + Tab)
#                 elif command == "NEXT_APP":
#                     with keyboard.pressed(Key.cmd):
#                         keyboard.press(Key.tab)
#                         keyboard.release(Key.tab)

#                 else:
#                     print(f"Unknown command: {data}")

#             except ConnectionResetError:
#                 print("Client forcibly disconnected.")
#                 break
#             except Exception as e:
#                 print(f"An error occurred: {e}")
#                 break

# print("Server stopped.")


# import socket
# import threading
# import sys
# from pynput.mouse import Button, Controller as MouseController
# from pynput.keyboard import Key, Controller as KeyboardController
# from PyQt5.QtWidgets import QApplication, QWidget, QLabel, QPushButton, QVBoxLayout
# from PyQt5.QtCore import Qt

# # Controllers
# mouse = MouseController()
# keyboard = KeyboardController()

# # Server configuration
# HOST = "0.0.0.0"
# PORT = 12345

# # Global variables
# server_socket = None
# server_thread = None
# running = False
# connected_devices = 0


# def get_local_ip():
#     try:
#         s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
#         s.connect(("8.8.8.8", 80))
#         ip = s.getsockname()[0]
#         s.close()
#         return ip
#     except:
#         return "Unknown"


# def handle_client(conn, addr, app):
#     global connected_devices
#     connected_devices += 1
#     app.update_devices_label()

#     with conn:
#         while running:
#             try:
#                 data = conn.recv(1024).decode("utf-8").strip()
#                 if not data:
#                     break

#                 parts = data.split()
#                 command = parts[0]

#                 if command == "MOVE" and len(parts) == 3:
#                     try:
#                         dx, dy = int(parts[1]), int(parts[2])
#                         mouse.move(dx, dy)
#                     except ValueError:
#                         pass

#                 elif command == "CLICK_LEFT":
#                     mouse.click(Button.left)

#                 elif command == "CLICK_RIGHT":
#                     mouse.click(Button.right)

#                 elif command == "SCROLL" and len(parts) == 2:
#                     try:
#                         dy = int(parts[1])
#                         mouse.scroll(0, dy * 3)
#                     except ValueError:
#                         pass

#                 elif command == "DESKTOP_LEFT":
#                     with keyboard.pressed(Key.ctrl):
#                         keyboard.press(Key.left)
#                         keyboard.release(Key.left)

#                 elif command == "DESKTOP_RIGHT":
#                     with keyboard.pressed(Key.ctrl):
#                         keyboard.press(Key.right)
#                         keyboard.release(Key.right)

#                 elif command == "NEXT_APP":
#                     with keyboard.pressed(Key.cmd):
#                         keyboard.press(Key.tab)
#                         keyboard.release(Key.tab)

#             except:
#                 break

#     connected_devices -= 1
#     app.update_devices_label()


# def server_loop(app):
#     global server_socket, running
#     server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#     server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
#     server_socket.bind((HOST, PORT))
#     server_socket.listen(5)

#     while running:
#         try:
#             conn, addr = server_socket.accept()
#             threading.Thread(target=handle_client, args=(conn, addr, app), daemon=True).start()
#         except OSError:
#             break


# def start_server(app):
#     global running, server_thread
#     if not running:
#         running = True
#         server_thread = threading.Thread(target=server_loop, args=(app,), daemon=True)
#         server_thread.start()
#         app.update_status("Running")


# def stop_server(app):
#     global running, server_socket
#     running = False
#     if server_socket:
#         try:
#             server_socket.close()
#         except:
#             pass
#     app.update_status("Stopped")


# # ------------------- PyQt5 App -------------------
# class ServerApp(QWidget):
#     def __init__(self):
#         super().__init__()
#         self.setWindowTitle("Remote Mouse Server")
#         self.setGeometry(200, 200, 400, 220)

#         self.ip_label = QLabel(f"Your Mac IP: {get_local_ip()} : {PORT}", self)
#         self.ip_label.setAlignment(Qt.AlignCenter)

#         self.status_label = QLabel("Server Status: Stopped", self)
#         self.status_label.setAlignment(Qt.AlignCenter)

#         self.devices_label = QLabel("Connected Devices: 0", self)
#         self.devices_label.setAlignment(Qt.AlignCenter)

#         self.start_button = QPushButton("Start Server", self)
#         self.start_button.setStyleSheet("background-color: green; color: white; font-weight: bold;")
#         self.start_button.clicked.connect(lambda: start_server(self))

#         self.stop_button = QPushButton("Stop Server", self)
#         self.stop_button.setStyleSheet("background-color: red; color: white; font-weight: bold;")
#         self.stop_button.clicked.connect(lambda: stop_server(self))

#         layout = QVBoxLayout()
#         layout.addWidget(self.ip_label)
#         layout.addWidget(self.status_label)
#         layout.addWidget(self.devices_label)
#         layout.addWidget(self.start_button)
#         layout.addWidget(self.stop_button)

#         self.setLayout(layout)

#     def update_status(self, status):
#         self.status_label.setText(f"Server Status: {status}")

#     def update_devices_label(self):
#         self.devices_label.setText(f"Connected Devices: {connected_devices}")


# if __name__ == "__main__":
#     app = QApplication(sys.argv)
#     window = ServerApp()
#     window.show()
#     sys.exit(app.exec_())


# import sys
# import socket
# import threading
# from pynput.mouse import Button, Controller as MouseController
# from pynput.keyboard import Key, Controller as KeyboardController
# from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QLabel, QPushButton, QMessageBox
# from PyQt5.QtCore import Qt

# # Controllers
# mouse = MouseController()
# keyboard = KeyboardController()

# # Server Config
# HOST = "0.0.0.0"
# PORT = 12345
# server_running = False
# client_threads = []
# connections = []
# server_socket = None


# def get_local_ip():
#     try:
#         s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
#         s.connect(("8.8.8.8", 80))
#         ip = s.getsockname()[0]
#         s.close()
#         return ip
#     except:
#         return "Unknown"


# def handle_client(conn, addr, app):
#     connections.append(addr)
#     app.update_devices()
#     with conn:
#         print(f"Connected by {addr}")
#         while True:
#             try:
#                 data = conn.recv(1024).decode("utf-8").strip()
#                 if not data:
#                     print(f"{addr} disconnected")
#                     break

#                 parts = data.split()
#                 command = parts[0]

#                 if command == "MOVE" and len(parts) == 3:
#                     try:
#                         dx, dy = int(parts[1]), int(parts[2])
#                         mouse.move(dx, dy)
#                     except ValueError:
#                         pass

#                 elif command == "CLICK_LEFT":
#                     mouse.click(Button.left)

#                 elif command == "CLICK_RIGHT":
#                     mouse.click(Button.right)

#                 elif command == "SCROLL" and len(parts) == 2:
#                     try:
#                         dy = int(parts[1])
#                         mouse.scroll(0, dy * 3)
#                     except ValueError:
#                         pass

#                 elif command == "DESKTOP_LEFT":
#                     with keyboard.pressed(Key.ctrl):
#                         keyboard.press(Key.left)
#                         keyboard.release(Key.left)

#                 elif command == "DESKTOP_RIGHT":
#                     with keyboard.pressed(Key.ctrl):
#                         keyboard.press(Key.right)
#                         keyboard.release(Key.right)

#                 elif command == "NEXT_APP":
#                     with keyboard.pressed(Key.cmd):
#                         keyboard.press(Key.tab)
#                         keyboard.release(Key.tab)

#             except Exception as e:
#                 print("Error:", e)
#                 break
#     connections.remove(addr)
#     app.update_devices()


# def start_server(app):
#     global server_socket, server_running
#     if server_running:
#         return

#     server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#     server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
#     server_socket.bind((HOST, PORT))
#     server_socket.listen(5)
#     server_running = True
#     app.update_status("Running")

#     def accept_clients():
#         while server_running:
#             try:
#                 conn, addr = server_socket.accept()
#                 thread = threading.Thread(target=handle_client, args=(conn, addr, app), daemon=True)
#                 client_threads.append(thread)
#                 thread.start()
#             except:
#                 break

#     threading.Thread(target=accept_clients, daemon=True).start()


# def stop_server(app):
#     global server_running, server_socket
#     server_running = False
#     if server_socket:
#         try:
#             server_socket.close()
#         except:
#             pass
#     app.update_status("Stopped")
#     connections.clear()
#     app.update_devices()


# # ---------------- UI ----------------
# class ServerApp(QWidget):
#     def __init__(self):
#         super().__init__()
#         self.setWindowTitle("Remote Mouse Server")
#         self.setGeometry(600, 250, 400, 300)
#         self.setStyleSheet("""
#             QWidget {
#                 background-color: #1e1e2f;
#                 color: white;
#                 font-family: 'Segoe UI';
#                 font-size: 14px;
#             }
#             QPushButton {
#                 background-color: qlineargradient(
#                     x1:0, y1:0, x2:1, y2:0,
#                     stop:0 #4facfe, stop:1 #00f2fe
#                 );
#                 border-radius: 10px;
#                 padding: 10px;
#                 color: white;
#                 font-size: 15px;
#             }
#             QPushButton:hover {
#                 background-color: qlineargradient(
#                     x1:0, y1:0, x2:1, y2:0,
#                     stop:0 #43e97b, stop:1 #38f9d7
#                 );
#             }
#         """)

#         layout = QVBoxLayout()

#         self.ip_label = QLabel(f"Your Mac IP: {get_local_ip()} : {PORT}")
#         self.ip_label.setAlignment(Qt.AlignCenter)
#         layout.addWidget(self.ip_label)

#         self.status_label = QLabel("Server Status: Stopped")
#         self.status_label.setAlignment(Qt.AlignCenter)
#         layout.addWidget(self.status_label)

#         self.devices_label = QLabel("Connected Devices: 0")
#         self.devices_label.setAlignment(Qt.AlignCenter)
#         layout.addWidget(self.devices_label)

#         self.start_button = QPushButton("🚀 Start Server")
#         self.start_button.clicked.connect(lambda: start_server(self))
#         layout.addWidget(self.start_button)

#         self.stop_button = QPushButton("🛑 Stop Server")
#         self.stop_button.clicked.connect(lambda: stop_server(self))
#         layout.addWidget(self.stop_button)

#         self.setLayout(layout)

#     def update_status(self, status):
#         self.status_label.setText(f"Server Status: {status}")

#     def update_devices(self):
#         self.devices_label.setText(f"Connected Devices: {len(connections)}")

#     def closeEvent(self, event):
#         stop_server(self)
#         event.accept()


# if __name__ == "__main__":
#     app = QApplication(sys.argv)
#     window = ServerApp()
#     window.show()
#     sys.exit(app.exec_())

import os
import sys
import socket
import threading
from pynput.mouse import Button, Controller as MouseController
from pynput.keyboard import Key, Controller as KeyboardController
from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QLabel, QPushButton, QSystemTrayIcon
from PyQt5.QtGui import QIcon
from PyQt5.QtCore import Qt

# Controllers
mouse = MouseController()
keyboard = KeyboardController()

# Server Config
HOST = "0.0.0.0"
PORT = 12345
server_running = False
client_threads = []
connections = []
server_socket = None


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "Unknown"


def handle_client(conn, addr, app):
    connections.append(addr)
    app.update_devices()
    with conn:
        print(f"Connected by {addr}")
        while True:
            try:
                data = conn.recv(1024).decode("utf-8").strip()
                if not data:
                    print(f"{addr} disconnected")
                    break

                parts = data.split()
                command = parts[0]

                if command == "MOVE" and len(parts) == 3:
                    try:
                        dx, dy = int(parts[1]), int(parts[2])
                        mouse.move(dx, dy)
                    except ValueError:
                        pass

                elif command == "CLICK_LEFT":
                    mouse.click(Button.left)

                elif command == "CLICK_RIGHT":
                    mouse.click(Button.right)

                elif command == "SCROLL" and len(parts) == 2:
                    try:
                        dy = int(parts[1])
                        mouse.scroll(0, dy * 3)
                    except ValueError:
                        pass

                elif command == "DESKTOP_LEFT":
                    with keyboard.pressed(Key.ctrl):
                        keyboard.press(Key.left)
                        keyboard.release(Key.left)

                elif command == "DESKTOP_RIGHT":
                    with keyboard.pressed(Key.ctrl):
                        keyboard.press(Key.right)
                        keyboard.release(Key.right)

                elif command == "NEXT_APP":
                    with keyboard.pressed(Key.cmd):
                        keyboard.press(Key.tab)
                        keyboard.release(Key.tab)

            except Exception as e:
                print("Error:", e)
                break
    connections.remove(addr)
    app.update_devices()


def start_server(app):
    global server_socket, server_running
    if server_running:
        return

    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind((HOST, PORT))
    server_socket.listen(5)
    server_running = True
    app.update_status("Running")

    def accept_clients():
        while server_running:
            try:
                conn, addr = server_socket.accept()
                thread = threading.Thread(target=handle_client, args=(conn, addr, app), daemon=True)
                client_threads.append(thread)
                thread.start()
            except:
                break

    threading.Thread(target=accept_clients, daemon=True).start()


def stop_server(app):
    global server_running, server_socket
    server_running = False
    if server_socket:
        try:
            server_socket.close()
        except:
            pass
    app.update_status("Stopped")
    connections.clear()
    app.update_devices()


# ---------------- UI ----------------
class ServerApp(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Remote Mouse Server")
        self.setGeometry(600, 250, 400, 300)
        self.setStyleSheet("""
            QWidget {
                background-color: #1e1e2f;
                color: white;
                font-family: 'Segoe UI';
                font-size: 14px;
            }
            QPushButton {
                background-color: qlineargradient(
                    x1:0, y1:0, x2:1, y2:0,
                    stop:0 #4facfe, stop:1 #00f2fe
                );
                border-radius: 10px;
                padding: 10px;
                color: white;
                font-size: 15px;
            }
            QPushButton:hover {
                background-color: qlineargradient(
                    x1:0, y1:0, x2:1, y2:0,
                    stop:0 #43e97b, stop:1 #38f9d7
                );
            }
        """)

        layout = QVBoxLayout()

        self.ip_label = QLabel(f"Your Mac IP: {get_local_ip()} : {PORT}")
        self.ip_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.ip_label)

        self.status_label = QLabel("Server Status: Stopped")
        self.status_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.status_label)

        self.devices_label = QLabel("Connected Devices: 0")
        self.devices_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.devices_label)

        self.start_button = QPushButton("🚀 Start Server")
        self.start_button.clicked.connect(lambda: start_server(self))
        layout.addWidget(self.start_button)

        self.stop_button = QPushButton("🛑 Stop Server")
        self.stop_button.clicked.connect(lambda: stop_server(self))
        layout.addWidget(self.stop_button)

        self.setLayout(layout)

        # Add tray icon (NO menu, just the icon)
        # self.tray_icon = QSystemTrayIcon(self)
        # self.tray_icon.setIcon(QIcon.fromTheme("network-server"))  # fallback: pick system theme icon
        # self.tray_icon.show()
        icon_path = os.path.join(os.path.dirname(__file__), "remote.png")
        self.tray_icon = QSystemTrayIcon(self)
        self.tray_icon.setIcon(QIcon(icon_path))
        self.tray_icon.setVisible(True)

    def update_status(self, status):
        self.status_label.setText(f"Server Status: {status}")

    def update_devices(self):
        self.devices_label.setText(f"Connected Devices: {len(connections)}")

    def closeEvent(self, event):
        stop_server(self)
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = ServerApp()
    window.show()
    sys.exit(app.exec_())

