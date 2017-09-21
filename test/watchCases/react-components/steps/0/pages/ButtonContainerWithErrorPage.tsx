import * as React from "react";
import { ButtonContainerWithError } from "../component/container/ButtonContainerWithError";


export class ButtonContainerWithErrorPage extends React.Component<{}, {}> {
  render() {
    return (
      <div>
        <ButtonContainerWithError>Page2</ButtonContainerWithError>
      </div>
    );
  }
}

