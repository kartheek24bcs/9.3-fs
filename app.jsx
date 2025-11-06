# ============================================
# AWS FULL STACK DEPLOYMENT WITH LOAD BALANCING
# Complete Infrastructure Setup
# ============================================

# This comprehensive guide includes:
# 1. Full Stack Application Code (React + Node.js + MongoDB)
# 2. AWS Infrastructure Setup Scripts
# 3. Load Balancer Configuration
# 4. Security Groups & VPC Setup
# 5. Auto Scaling Configuration
# 6. Deployment Scripts
# 7. Monitoring & Health Checks

# ============================================
# PART 1: BACKEND APPLICATION (Node.js/Express)
# ============================================

# FILE: backend/server.js
cat > backend/server.js << 'EOF'
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fullstack-app';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Task Schema
const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  serverHostname: String,
  serverIp: String
});

const Task = mongoose.model('Task', TaskSchema);

// Health Check Endpoint (for ALB)
app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    hostname: os.hostname(),
    ip: getServerIp()
  };
  
  res.status(200).json(healthcheck);
});

// Server Info Endpoint
app.get('/api/server-info', (req, res) => {
  res.json({
    hostname: os.hostname(),
    ip: getServerIp(),
    platform: os.platform(),
    uptime: process.uptime(),
    memory: {
      total: Math.round(os.totalmem() / 1024 / 1024),
      free: Math.round(os.freemem() / 1024 / 1024)
    }
  });
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const task = new Task({
      ...req.body,
      serverHostname: os.hostname(),
      serverIp: getServerIp()
    });
    const savedTask = await task.save();
    res.status(201).json(savedTask);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Utility function
function getServerIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'unknown';
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Hostname: ${os.hostname()}`);
  console.log(`🌐 IP: ${getServerIp()}`);
});
EOF

# FILE: backend/package.json
cat > backend/package.json << 'EOF'
{
  "name": "fullstack-backend",
  "version": "1.0.0",
  "description": "Full Stack Backend with Load Balancing",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.6.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

# FILE: backend/.env.example
cat > backend/.env.example << 'EOF'
PORT=5000
MONGODB_URI=mongodb://localhost:27017/fullstack-app
NODE_ENV=production
EOF

# ============================================
# PART 2: FRONTEND APPLICATION (React)
# ============================================

# FILE: frontend/src/App.js
cat > frontend/src/App.js << 'EOF'
import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [tasks, setTasks] = useState([]);
  const [serverInfo, setServerInfo] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchServerInfo();
    const interval = setInterval(fetchServerInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tasks`);
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchServerInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/server-info`);
      const data = await response.json();
      setServerInfo(data);
    } catch (error) {
      console.error('Error fetching server info:', error);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await response.json();
      setTasks([data, ...tasks]);
      setNewTask({ title: '', description: '' });
      fetchServerInfo();
    } catch (error) {
      console.error('Error creating task:', error);
    }
    setLoading(false);
  };

  const toggleTask = async (id, completed) => {
    try {
      const response = await fetch(`${API_URL}/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });
      const data = await response.json();
      setTasks(tasks.map(task => task._id === id ? data : task));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (id) => {
    try {
      await fetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' });
      setTasks(tasks.filter(task => task._id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 AWS Load Balanced App</h1>
        
        {serverInfo && (
          <div className="server-info">
            <h3>🖥️ Current Server</h3>
            <div className="info-grid">
              <div><strong>Hostname:</strong> {serverInfo.hostname}</div>
              <div><strong>IP:</strong> {serverInfo.ip}</div>
              <div><strong>Uptime:</strong> {Math.round(serverInfo.uptime)}s</div>
              <div><strong>Memory:</strong> {serverInfo.memory.free}MB / {serverInfo.memory.total}MB</div>
            </div>
          </div>
        )}

        <form onSubmit={createTask} className="task-form">
          <input
            type="text"
            placeholder="Task Title"
            value={newTask.title}
            onChange={(e) => setNewTask({...newTask, title: e.target.value})}
            required
          />
          <input
            type="text"
            placeholder="Description"
            value={newTask.description}
            onChange={(e) => setNewTask({...newTask, description: e.target.value})}
          />
          <button type="submit" disabled={loading}>
            {loading ? '⏳' : '➕'} Add Task
          </button>
        </form>

        <div className="tasks-container">
          <h2>📋 Tasks ({tasks.length})</h2>
          {tasks.map(task => (
            <div key={task._id} className={`task ${task.completed ? 'completed' : ''}`}>
              <div className="task-content">
                <h3 onClick={() => toggleTask(task._id, task.completed)}>
                  {task.completed ? '✅' : '⭕'} {task.title}
                </h3>
                <p>{task.description}</p>
                <small>Server: {task.serverHostname || 'N/A'} | {task.serverIp || 'N/A'}</small>
              </div>
              <button onClick={() => deleteTask(task._id)} className="delete-btn">
                🗑️
              </button>
            </div>
          ))}
        </div>
      </header>
    </div>
  );
}

export default App;
EOF

# FILE: frontend/src/App.css
cat > frontend/src/App.css << 'EOF'
.App {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.App-header {
  max-width: 1200px;
  margin: 0 auto;
  color: white;
}

h1 {
  text-align: center;
  font-size: 3rem;
  margin-bottom: 2rem;
}

.server-info {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.task-form {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.task-form input {
  flex: 1;
  min-width: 200px;
  padding: 1rem;
  border-radius: 10px;
  border: none;
  font-size: 1rem;
}

.task-form button {
  padding: 1rem 2rem;
  border-radius: 10px;
  border: none;
  background: #4CAF50;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.task-form button:hover {
  background: #45a049;
  transform: translateY(-2px);
}

.task-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tasks-container {
  margin-top: 2rem;
}

.task {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s;
}

.task:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.task.completed {
  opacity: 0.7;
}

.task.completed h3 {
  text-decoration: line-through;
}

.task-content {
  flex: 1;
}

.task h3 {
  margin: 0 0 0.5rem 0;
  cursor: pointer;
  font-size: 1.5rem;
}

.task p {
  margin: 0.5rem 0;
  opacity: 0.9;
}

.task small {
  opacity: 0.7;
  font-size: 0.8rem;
}

.delete-btn {
  background: #f44336;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.3s;
}

.delete-btn:hover {
  background: #da190b;
  transform: scale(1.1);
}
EOF

# FILE: frontend/package.json
cat > frontend/package.json << 'EOF'
{
  "name": "fullstack-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": ["react-app"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
EOF

# FILE: frontend/.env.example
cat > frontend/.env.example << 'EOF'
REACT_APP_API_URL=http://your-alb-dns-name.region.elb.amazonaws.com
EOF

# ============================================
# PART 3: AWS INFRASTRUCTURE SETUP
# ============================================

# FILE: aws-setup.sh
cat > aws-setup.sh << 'EOF'
#!/bin/bash

# AWS Full Stack Deployment Script
# Prerequisites: AWS CLI configured with appropriate credentials

set -e

echo "🚀 Starting AWS Full Stack Deployment..."

# Configuration Variables
AWS_REGION="us-east-1"
VPC_NAME="fullstack-vpc"
KEY_PAIR_NAME="fullstack-key"
AMI_ID="ami-0c55b159cbfafe1f0"  # Amazon Linux 2 (update for your region)
INSTANCE_TYPE="t3.micro"
DB_INSTANCE_TYPE="t3.small"

# Step 1: Create VPC
echo "📦 Creating VPC..."
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$VPC_NAME}]" \
  --region $AWS_REGION \
  --query 'Vpc.VpcId' \
  --output text)

echo "✅ VPC Created: $VPC_ID"

# Enable DNS hostnames
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-hostnames \
  --region $AWS_REGION

# Step 2: Create Internet Gateway
echo "🌐 Creating Internet Gateway..."
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${VPC_NAME}-igw}]" \
  --region $AWS_REGION \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region $AWS_REGION

echo "✅ Internet Gateway Created: $IGW_ID"

# Step 3: Create Subnets (2 public, 2 private)
echo "🏗️ Creating Subnets..."

# Public Subnet 1 (us-east-1a)
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ${AWS_REGION}a \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1}]" \
  --region $AWS_REGION \
  --query 'Subnet.SubnetId' \
  --output text)

# Public Subnet 2 (us-east-1b)
PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ${AWS_REGION}b \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-2}]" \
  --region $AWS_REGION \
  --query 'Subnet.SubnetId' \
  --output text)

# Private Subnet 1
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.3.0/24 \
  --availability-zone ${AWS_REGION}a \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1}]" \
  --region $AWS_REGION \
  --query 'Subnet.SubnetId' \
  --output text)

# Private Subnet 2
PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.4.0/24 \
  --availability-zone ${AWS_REGION}b \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-2}]" \
  --region $AWS_REGION \
  --query 'Subnet.SubnetId' \
  --output text)

echo "✅ Subnets Created"

# Step 4: Create Route Table and Routes
echo "🛣️ Creating Route Tables..."
ROUTE_TABLE_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=public-rt}]" \
  --region $AWS_REGION \
  --query 'RouteTable.RouteTableId' \
  --output text)

aws ec2 create-route \
  --route-table-id $ROUTE_TABLE_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region $AWS_REGION

# Associate route table with public subnets
aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_1 \
  --route-table-id $ROUTE_TABLE_ID \
  --region $AWS_REGION

aws ec2 associate-route-table \
  --subnet-id $PUBLIC_SUBNET_2 \
  --route-table-id $ROUTE_TABLE_ID \
  --region $AWS_REGION

echo "✅ Route Tables Configured"

# Step 5: Create Security Groups
echo "🔒 Creating Security Groups..."

# ALB Security Group
ALB_SG=$(aws ec2 create-security-group \
  --group-name alb-sg \
  --description "Security group for Application Load Balancer" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION

# Backend Security Group
BACKEND_SG=$(aws ec2 create-security-group \
  --group-name backend-sg \
  --description "Security group for backend instances" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $BACKEND_SG \
  --protocol tcp \
  --port 5000 \
  --source-group $ALB_SG \
  --region $AWS_REGION

aws ec2 authorize-security-group-ingress \
  --group-id $BACKEND_SG \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION

# Frontend Security Group
FRONTEND_SG=$(aws ec2 create-security-group \
  --group-name frontend-sg \
  --description "Security group for frontend instance" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $FRONTEND_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION

aws ec2 authorize-security-group-ingress \
  --group-id $FRONTEND_SG \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION

# Database Security Group
DB_SG=$(aws ec2 create-security-group \
  --group-name db-sg \
  --description "Security group for MongoDB" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $DB_SG \
  --protocol tcp \
  --port 27017 \
  --source-group $BACKEND_SG \
  --region $AWS_REGION

echo "✅ Security Groups Created"

# Step 6: Create Key Pair
echo "🔑 Creating Key Pair..."
aws ec2 create-key-pair \
  --key-name $KEY_PAIR_NAME \
  --region $AWS_REGION \
  --query 'KeyMaterial' \
  --output text > ${KEY_PAIR_NAME}.pem

chmod 400 ${KEY_PAIR_NAME}.pem

echo "✅ Key Pair Created: ${KEY_PAIR_NAME}.pem"

# Step 7: Create Target Group
echo "🎯 Creating Target Group..."
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
  --name backend-tg \
  --protocol HTTP \
  --port 5000 \
  --vpc-id $VPC_ID \
  --health-check-enabled \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $AWS_REGION \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "✅ Target Group Created: $TARGET_GROUP_ARN"

# Step 8: Create Application Load Balancer
echo "⚖️ Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name backend-alb \
  --subnets $PUBLIC_SUBNET_1 $PUBLIC_SUBNET_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --region $AWS_REGION \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --region $AWS_REGION \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "✅ Load Balancer Created: $ALB_DNS"

# Step 9: Create Listener
echo "👂 Creating ALB Listener..."
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
  --region $AWS_REGION

echo "✅ Listener Created"

# Save configuration
cat > aws-config.txt << CONFIG
VPC_ID=$VPC_ID
IGW_ID=$IGW_ID
PUBLIC_SUBNET_1=$PUBLIC_SUBNET_1
PUBLIC_SUBNET_2=$PUBLIC_SUBNET_2
PRIVATE_SUBNET_1=$PRIVATE_SUBNET_1
PRIVATE_SUBNET_2=$PRIVATE_SUBNET_2
ALB_SG=$ALB_SG
BACKEND_SG=$BACKEND_SG
FRONTEND_SG=$FRONTEND_SG
DB_SG=$DB_SG
TARGET_GROUP_ARN=$TARGET_GROUP_ARN
ALB_ARN=$ALB_ARN
ALB_DNS=$ALB_DNS
KEY_PAIR_NAME=$KEY_PAIR_NAME
CONFIG

echo "📝 Configuration saved to aws-config.txt"
echo ""
echo "✅ AWS Infrastructure Setup Complete!"
echo ""
echo "📊 Summary:"
echo "  - VPC ID: $VPC_ID"
echo "  - Load Balancer DNS: $ALB_DNS"
echo "  - Key Pair: ${KEY_PAIR_NAME}.pem"
echo ""
echo "🔜 Next Steps:"
echo "  1. Launch EC2 instances (run deploy-instances.sh)"
echo "  2. Configure applications"
echo "  3. Test the deployment"
EOF

chmod +x aws-setup.sh

# ============================================
# PART 4: EC2 INSTANCE DEPLOYMENT
# ============================================

# FILE: deploy-instances.sh
cat > deploy-instances.sh << 'EOF'
#!/bin/bash

set -e

# Load configuration
source aws-config.txt

AWS_REGION="us-east-1"
AMI_ID="ami-0c55b159cbfafe1f0"  # Amazon Linux 2 - update for your region
INSTANCE_TYPE="t3.micro"

echo "🚀 Deploying EC2 Instances..."

# User Data for Database Instance
cat > db-user-data.sh << 'USERDATA'
#!/bin/bash
yum update -y
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  -v /data/db:/data/db \
  mongo:latest
USERDATA

# Launch Database Instance
echo "🗄️ Launching Database Instance..."
DB_INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.small \
  --key-name $KEY_PAIR_NAME \
  --security-group-ids $DB_SG \
  --subnet-id $PRIVATE_SUBNET_1 \
  --user-data file://db-user-data.sh \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=mongodb-server}]" \
  --region $AWS_REGION \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "⏳ Waiting for database instance..."
aws ec2 wait instance-running --instance-ids $DB_INSTANCE_ID --region $AWS_REGION

DB_PRIVATE_IP=$(aws ec2 describe-instances \
  --instance-ids $DB_INSTANCE_ID \
  --region $AWS_REGION \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' \
  --output text)

echo "✅ Database Instance Running: $DB_PRIVATE_IP"

# User Data for Backend Instances
cat > backend-user-data.sh << USERDATA
#!/bin/bash
