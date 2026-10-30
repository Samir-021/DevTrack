import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';
import { User } from './models/user.js';
import { Project } from './models/project.js';

// Use the same DNS resolver configured in server.js.
dns.setServers(['1.1.1.1']);

const email = 'samir@gmail.com';

async function migrateProjects() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('MongoDB connected.');

    const user = await User.findOne({
      email: email.toLowerCase()
    });

    if (!user) {
      console.error(`User not found: ${email}`);
      return;
    }

    console.log(`Found user: ${user.name} (${user._id})`);

    const result = await Project.updateMany(
      {
        owner: { $exists: false }
      },
      {
        $set: {
          owner: user._id
        }
      }
    );

    console.log(`Projects matched: ${result.matchedCount}`);
    console.log(`Projects modified: ${result.modifiedCount}`);

    console.log('Project ownership migration completed.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

migrateProjects();