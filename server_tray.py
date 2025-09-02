

# ### import socket
# import socket
# import threading
# import pyautogui
# import pystray
# from PIL import Image, ImageDraw

# clients = []
# server_socket = None
# running = False
# tray_icon = None

# # ---------------- Socket Server ----------------
# def handle_client(client, addr):
#     global clients, running
#     clients.append(client)
#     update_tray_title()
#     print(f"Server: Client connected from {addr}")

#     # Maintain a buffer for incomplete messages
#     recv_buffer = ""

#     while running:
#         try:
#             data = client.recv(1024).decode()
#             if not data:  # Client closed connection gracefully
#                 print(f"Server: Client {addr} disconnected gracefully.")
#                 break

#             recv_buffer += data  # Add received data to buffer

#             # Process all complete lines in the buffer
#             while "\n" in recv_buffer:
#                 line, recv_buffer = recv_buffer.split("\n", 1)  # Split at first newline
#                 parts = line.strip().split(",")

#                 if not parts or not parts[0]:  # Handle empty or malformed lines
#                     print(f"Server: Malformed line: '{line}' from {addr}")
#                     continue

#                 command = parts[0]

#                 if command == "MOVE":
#                     try:
#                         dx, dy = int(parts[1]), int(parts[2])
#                         pyautogui.moveRel(dx, dy)
#                     except (ValueError, IndexError) as e:
#                         print(f"Server: Invalid MOVE data from {addr}: '{line}' Error: {e}")
#                     except Exception as e:
#                         print(f"Server: Unexpected MOVE error from {addr}: {e}")

#                 elif command == "CLICK":
#                     pyautogui.click()

#                 elif command == "RIGHT_CLICK":
#                     pyautogui.click(button="right")

#                 elif command == "SCROLL":
#                     try:
#                         pyautogui.scroll(int(parts[1]))
#                     except (ValueError, IndexError) as e:
#                         print(f"Server: Invalid SCROLL data from {addr}: '{line}' Error: {e}")

#                 elif command == "PING":
#                     try:
#                         client.sendall(b"PONG\n")  # reply to keepalive
#                     except BrokenPipeError:
#                         print(f"Server: Broken pipe while replying PONG to {addr}")
#                         break

#                 else:
#                     print(f"Server: Unknown command from {addr}: '{line}'")

#         except ConnectionResetError as e:
#             print(f"Server: Client {addr} reset connection: {e}")
#             break
#         except BrokenPipeError as e:
#             print(f"Server: Broken pipe for client {addr}: {e}")
#             break
#         except socket.timeout:
#             print(f"Server: Client {addr} socket timeout")
#             break
#         except socket.error as e:
#             print(f"Server: Socket error with {addr}: {e}")
#             break
#         except Exception as e:
#             print(f"Server: UNHANDLED exception for {addr}: {e}")
#             break

#     # Cleanup when client disconnects
#     if client in clients:
#         clients.remove(client)
#     try:
#         client.close()
#     except Exception as e:
#         print(f"Server: Error closing socket for {addr}: {e}")
#     update_tray_title()
#     print(f"Server: Client {addr} connection closed.")

# def start_server():
#     global server_socket, running
#     if running:
#         return
#     running = True
#     server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#     server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
#     server_socket.bind(("0.0.0.0", 5000))
#     server_socket.listen(5)
#     print("Server started on port 5000...")

#     def accept_clients():
#         while running:
#             try:
#                 client, addr = server_socket.accept()
#                 threading.Thread(target=handle_client, args=(client, addr), daemon=True).start()
#             except:
#                 break

#     threading.Thread(target=accept_clients, daemon=True).start()
#     update_tray_title()

# def stop_server():
#     global server_socket, running, clients
#     if not running:
#         return
#     running = False
#     for c in clients:
#         try:
#             c.close()
#         except:
#             pass
#     clients.clear()
#     if server_socket:
#         try:
#             server_socket.close()
#         except:
#             pass
#         server_socket = None
#     update_tray_title()
#     print("Server stopped.")

# # ---------------- Tray UI ----------------
# def create_image(width, height, color1, color2):
#     image = Image.new('RGB', (width, height), color1)
#     dc = ImageDraw.Draw(image)
#     dc.rectangle((width//2, 0, width, height//2), fill=color2)
#     dc.rectangle((0, height//2, width//2, height), fill=color2)
#     return image

# def update_tray_title():
#     if tray_icon:
#         tray_icon.title = f"Remote Mouse (Clients: {len(clients)})"

# def on_start(icon, item):
#     start_server()

# def on_stop(icon, item):
#     stop_server()

# def on_exit(icon, item):
#     stop_server()
#     icon.stop()

# def setup_tray():
#     global tray_icon
#     image = create_image(64, 64, "black", "white")
#     menu = pystray.Menu(
#         pystray.MenuItem("Start Server", on_start),
#         pystray.MenuItem("Stop Server", on_stop),
#         pystray.MenuItem("Exit", on_exit)
#     )
#     tray_icon = pystray.Icon("Remote Mouse Server", image, "Remote Mouse", menu)
#     tray_icon.run()

# if __name__ == "__main__":
#     setup_tray()


import socket
import threading
import pyautogui
import pystray
from PIL import Image, ImageDraw
import sys

clients = []
server_socket = None
running = False
tray_icon = None

# ---------------- Socket Server ----------------
def handle_client(client, addr):
    global clients, running
    clients.append(client)
    update_tray_title()
    print(f"Server: Client connected from {addr}", flush=True)

    recv_buffer = ""  # Maintain buffer for incomplete messages

    while running:
        try:
            data = client.recv(1024).decode()
            if not data:
                print(f"Server: Client {addr} disconnected gracefully.", flush=True)
                break

            recv_buffer += data
            while "\n" in recv_buffer:
                line, recv_buffer = recv_buffer.split("\n", 1)
                parts = line.strip().split(",")

                if not parts or not parts[0]:
                    print(f"Server: Malformed line: '{line}'", flush=True)
                    continue

                command = parts[0]

                if command == "MOVE":
                    try:
                        dx, dy = int(parts[1]), int(parts[2])
                        pyautogui.moveRel(dx, dy)
                    except Exception as e:
                        print(f"Server: MOVE error {e}", flush=True)

                elif command == "CLICK":
                    pyautogui.click()

                elif command == "RIGHT_CLICK":
                    pyautogui.click(button="right")

                elif command == "SCROLL":
                    try:
                        pyautogui.scroll(int(parts[1]))
                    except Exception as e:
                        print(f"Server: SCROLL error {e}", flush=True)

                elif command == "PING":
                    try:
                        client.sendall(b"PONG\n")
                    except BrokenPipeError:
                        print(f"Server: Broken pipe replying PONG", flush=True)
                        break

                else:
                    print(f"Server: Unknown command '{line}'", flush=True)

        except Exception as e:
            print(f"Server: Client {addr} exception {e}", flush=True)
            break

    if client in clients:
        clients.remove(client)
    try:
        client.close()
    except:
        pass
    update_tray_title()
    print(f"Server: Client {addr} connection closed.", flush=True)


def start_server():
    global server_socket, running
    if running:
        return
    running = True
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind(("0.0.0.0", 5000))
    server_socket.listen(5)
    print("Server started on port 5000...", flush=True)

    def accept_clients():
        while running:
            try:
                client, addr = server_socket.accept()
                threading.Thread(target=handle_client, args=(client, addr), daemon=True).start()
            except:
                break

    threading.Thread(target=accept_clients, daemon=True).start()
    update_tray_title()


def stop_server():
    global server_socket, running, clients
    if not running:
        return
    running = False
    for c in clients:
        try:
            c.close()
        except:
            pass
    clients.clear()
    if server_socket:
        try:
            server_socket.close()
        except:
            pass
        server_socket = None
    update_tray_title()
    print("Server stopped.", flush=True)


# ---------------- Tray UI ----------------
def create_image(width, height, color1, color2):
    image = Image.new('RGB', (width, height), color1)
    dc = ImageDraw.Draw(image)
    dc.rectangle((width//2, 0, width, height//2), fill=color2)
    dc.rectangle((0, height//2, width//2, height), fill=color2)
    return image


def update_tray_title():
    if tray_icon:
        tray_icon.title = f"Remote Mouse (Clients: {len(clients)})"


def on_start(icon, item):
    start_server()


def on_stop(icon, item):
    stop_server()


def on_exit(icon, item):
    stop_server()
    icon.stop()
    sys.exit(0)


def setup_tray():
    global tray_icon
    image = create_image(64, 64, "black", "white")
    menu = pystray.Menu(
        pystray.MenuItem("Start Server", on_start),
        pystray.MenuItem("Stop Server", on_stop),
        pystray.MenuItem("Exit", on_exit)
    )
    tray_icon = pystray.Icon("Remote Mouse Server", image, "Remote Mouse", menu)
    tray_icon.run()  # ✅ blocking, needed for macOS tray


if __name__ == "__main__":
    setup_tray()
    print("Tray icon running... Check the menu.", flush=True)

    # Keep the main thread alive
    try:
        while True:
            pass
    except KeyboardInterrupt:
        stop_server()
