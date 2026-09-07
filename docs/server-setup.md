# Server Setup — Ubuntu Server + Docker

Hardware: i5-13400, 32GB DDR4, 2x WD Red Plus 4TB (ZFS mirror), 1TB NVMe boot SSD.
OS: Ubuntu Server 24.04 LTS.

---

## 1. Install Ubuntu Server

1. Download Ubuntu Server 24.04 LTS from ubuntu.com
2. Flash to USB stick with Balena Etcher
3. Boot the server, select "Install Ubuntu Server"
4. When prompted for storage:
   - Select the 1TB NVMe drive for the OS
   - Choose "Use an entire disk" + "Set up this disk as an LVM group" (optional, or just use ext4)
   - The 2x 4TB WD Red drives will be set up manually for ZFS in step 2
5. Network: DHCP is fine (assign static IP in router later)
6. Hostname: `server`
7. Username: `cooper2n` (keep consistent with Pi)
8. Enable OpenSSH server when prompted
9. Skip Ubuntu Pro
10. Install

After reboot, SSH in from your Mac:
```bash
ssh cooper2n@<server-ip>
```

Find the server IP from your router's admin page, or check `ip addr` on the server.

---

## 2. Set Static IP

In your router's admin panel, assign a static DHCP lease for the server's MAC address. Pick something like `100.97.28.200` (outside DHCP range to avoid conflicts).

Alternatively, set it on the server with netplan:
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eno1:  # or whatever your interface is called
      dhcp4: false
      addresses:
        - 100.97.28.200/24
      routes:
        - to: default
          via: 100.97.28.1
      nameservers:
        addresses:
          - 1.1.1.1
          - 1.0.0.1
```

```bash
sudo netplan apply
```

---

## 3. ZFS RAID Mirror

Set up the 2x 4TB WD Red Plus drives as a ZFS mirror (RAID 1).

```bash
# Install ZFS utilities
sudo apt update && sudo apt install -y zfsutils-linux

# Check the drives are visible
lsblk
# Should show two 4TB drives, e.g. /dev/sdb and /dev/sdc

# Partition both drives (GPT, Solaris ZFS type)
sudo parted /dev/sdb --script mklabel gpt
sudo parted /dev/sdb --script mkpart primary 0% 100%
sudo parted /dev/sdb --script set 1 lvm on

sudo parted /dev/sdc --script mklabel gpt
sudo parted /dev/sdc --script mkpart primary 0% 100%
sudo parted /dev/sdc --script set 1 lvm on

# Create the ZFS mirror pool
sudo zpool create -o ashift=12 tank mirror /dev/sdb1 /dev/sdc1

# Verify
sudo zpool status tank
# Should show: mirror-0, state: ONLINE

# Create datasets
sudo zfs create tank/data          # app data, DB, backups
sudo zfs create tank/uploads       # uploaded images

# Set mount points
sudo zfs set mountpoint=/mnt/tank tank
# tank, tank/data, tank/uploads now mount at /mnt/tank, /mnt/tank/data, /mnt/tank/uploads

# Enable trim and auto-mount on boot
sudo zpool set autotrim=on tank
sudo zfs set compression=lz4 tank
```

Verify:
```bash
zpool status tank
df -h | grep tank
```

---

## 4. Docker + Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to docker group (no sudo needed for docker commands)
sudo usermod -aG docker cooper2n

# Log out and back in for group to take effect
exit
```

SSH back in, then verify:
```bash
docker --version
docker compose version
```

---

## 5. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status
```

Port 3000 stays internal (nginx handles traffic within Docker). No need to open it.

---

## 6. SSH Key Setup

On your Mac, copy your SSH key to the new server:
```bash
ssh-copy-id cooper2n@<server-ip>
```

Test passwordless login:
```bash
ssh cooper2n@<server-ip>
```

If it works, optionally disable password auth on the server:
```bash
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

---

## 7. Set Up Tailscale (Optional)

If you use Tailscale to reach the server from your Mac:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Note the Tailscale IP (e.g. `100.x.x.x`) — this is what you'll SSH to.

---

## 8. Timezone

```bash
sudo timedatectl set-timezone Europe/London
```

---

## 9. Verify Everything

Run these checks on the server:

```bash
# ZFS pool healthy
sudo zpool status tank

# Docker running
docker ps

# SSH works from Mac
# Firewall active
sudo ufw status

# DNS resolution working
ping -c 3 thebreaksurf.co.uk

# Timezone correct
timedatectl
```

---

## Next Steps

- [Migration plan](migration.md) — copy data from Pi to new server
- [CI/CD pipeline](cicd.md) — GitHub Actions for automated deploys
