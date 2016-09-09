from flask import Flask, request, render_template, jsonify
from flask_cors import CORS, cross_origin
import uuid
import json

app = Flask(__name__)
CORS(app)

configTable = {}

@app.route('/configure', methods=['POST'])
@cross_origin()
def index():
    try:
        with open('configTable.json', 'r') as f:
            configTable = json.load(f)
    # if the file is empty the ValueError will be thrown
    except:
        configTable = {}

    id = uuid.uuid4();
    configTable[id.urn[9:]] = request.json

    with open('configTable.json', 'w+') as f:
        json.dump(configTable, f)

    return jsonify(url="http://" + request.host + "/viz/" + id.urn[9:])

@app.route('/viz/<id>', methods=['GET'])
@cross_origin()
def visualize(id):
 # load from file:
 try:
   with open('configTable.json', 'r') as f:
       configTable = json.load(f)
    # if the file is empty the ValueError will be thrown
 except ValueError:
   configTable = {}
 config = configTable[id]
 return render_template('index.html', json_data = json.dumps(config))

if __name__ == '__main__':
    app.run(debug=True, threaded=True)
